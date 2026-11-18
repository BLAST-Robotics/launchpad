import { db, schema } from "@launchpad/db";
import {
  keysignWebhookSchema,
  type Role,
  signingResponseSchema,
  UNAUTHENTICATED,
} from "@launchpad/shared";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { writeAudit } from "../audit";
import { auth } from "../auth";
import { env } from "../env";
import { HttpError } from "../http-error";
import { verifySignature } from "../lib/hmac";
import { activeWaivers, waiverStatusForEntry } from "../lib/waivers";
import { logEvent } from "../observability";

async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  return (
    (await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      with: { rosterEntry: true, guardianLinks: { with: { rosterEntry: true } } },
    })) ?? null
  );
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof requireUser>>>;

/**
 * Which roster entry a person's waiver is about: their own, or their first linked child.
 * People with neither have nothing to sign.
 */
function targetEntry(user: SessionUser) {
  return user.rosterEntry ?? user.guardianLinks[0]?.rosterEntry ?? null;
}

export const waiverRoutes = new Elysia({ name: "waivers" })
  // The signing link the iframe loads. The URL comes from env, never from source.
  .get("/api/waivers/signing", async ({ request, set }) => {
    const user = await requireUser(request);
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const entry = targetEntry(user);
    if (!entry) {
      return signingResponseSchema.parse({
        connected: false,
        url: null,
        documentName: null,
        documentId: null,
        status: "not_required",
      });
    }
    const docs = await activeWaivers(entry.seasonId);
    const first = docs[0];
    const row = first
      ? await db.query.waiverDocuments.findFirst({
          where: eq(schema.waiverDocuments.id, first.id),
        })
      : null;
    const status = await waiverStatusForEntry(entry.seasonId, entry.id, entry.claimedByUserId);

    let url: string | null = null;
    if (env.KEYSIGN_SIGNING_URL && row) {
      const link = new URL(env.KEYSIGN_SIGNING_URL);
      // Minimal metadata contract (docs/KEYSIGN-INTEGRATION.md): ids only, no names or emails.
      link.searchParams.set("launchpadUserId", user.id);
      link.searchParams.set("waiverDocumentId", row.id);
      link.searchParams.set("signerRole", user.rosterEntry ? "student" : "guardian");
      link.searchParams.set("returnUrl", new URL("/waivers/done", request.url).toString());
      url = link.toString();
    }
    return signingResponseSchema.parse({
      connected: url !== null,
      url,
      documentName: row?.title ?? null,
      documentId: row?.id ?? null,
      status,
    });
  })

  // "I already filled out the form": an append-only, clearly labelled self-report.
  .post("/api/waivers/self-report", async ({ request, set }) => {
    const user = await requireUser(request);
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const entry = targetEntry(user);
    if (!entry) throw new HttpError(409, "NOTHING_TO_SIGN", "There is no waiver for your account.");
    const roles: Role[] = ["student"];
    const applicable = (await activeWaivers(entry.seasonId)).filter(
      (d) => d.audienceRoles.length === 0 || d.audienceRoles.some((r) => roles.includes(r)),
    );
    if (applicable.length === 0) {
      throw new HttpError(409, "NOTHING_TO_SIGN", "There is no waiver to sign right now.");
    }
    let recorded = 0;
    await db.transaction(async (tx) => {
      for (const doc of applicable) {
        const inserted = await tx
          .insert(schema.waiverSignatures)
          .values({
            waiverDocumentId: doc.id,
            userId: user.id,
            signedAt: new Date(),
            signerRole: user.rosterEntry ? "student" : "guardian",
            source: "self_reported",
          })
          .onConflictDoNothing()
          .returning({ id: schema.waiverSignatures.id });
        if (inserted.length > 0) {
          recorded += 1;
          await writeAudit(tx, {
            actorUserId: user.id,
            action: "waiver.self_reported",
            entity: "waiver_document",
            entityId: doc.id,
            after: { source: "self_reported" },
          });
        }
      }
    });
    logEvent("waiver.self_reported", { userId: user.id, recorded });
    return { ok: true, outcome: recorded > 0 ? "recorded" : "already_recorded" };
  })

  // KeySign completion callback. Authenticated by HMAC over the raw body, not by a session.
  .post("/api/webhooks/keysign", async ({ request, set }) => {
    const raw = await request.text();
    const header = request.headers.get("x-keysign-signature");
    if (!verifySignature(env.KEYSIGN_WEBHOOK_SECRET, raw, header)) {
      set.status = 401;
      return { error: { code: "BAD_SIGNATURE", message: "Signature check failed." } };
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "BAD_JSON", "The body is not valid JSON.");
    }
    const parsed = keysignWebhookSchema.safeParse(json);
    if (!parsed.success) throw new HttpError(422, "BAD_PAYLOAD", "The payload is not recognised.");
    const { metadata, signatureId, completedAt, pdfDriveId } = parsed.data;

    const [user, doc] = await Promise.all([
      db.query.users.findFirst({ where: eq(schema.users.id, metadata.launchpadUserId) }),
      db.query.waiverDocuments.findFirst({
        where: eq(schema.waiverDocuments.id, metadata.waiverDocumentId),
      }),
    ]);
    if (!user || !doc) throw new HttpError(422, "UNKNOWN_TARGET", "No matching person or waiver.");

    const inserted = await db
      .insert(schema.waiverSignatures)
      .values({
        waiverDocumentId: doc.id,
        userId: user.id,
        keysignSignatureId: signatureId,
        signedAt: new Date(completedAt),
        pdfDriveId: pdfDriveId ?? null,
        signerRole: metadata.signerRole ?? null,
        source: "keysign",
      })
      .onConflictDoNothing()
      .returning({ id: schema.waiverSignatures.id });
    // A duplicate delivery hits the unique (document, user, source) triple and is a no-op.
    logEvent("keysign.webhook", {
      userId: user.id,
      waiverDocumentId: doc.id,
      duplicate: inserted.length === 0,
    });
    return { ok: true, duplicate: inserted.length === 0 };
  });
