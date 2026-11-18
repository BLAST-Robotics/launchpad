# KeySign integration (waiver e-sign)

KeySign stays a separate service (D-008). LaunchPad reaches it in exactly two ways: it embeds
the signing page in an iframe, and it receives a signed completion webhook. No envelopes, no
multi-signer orchestration, and no KeySign auth changes beyond a webhook secret (D-009: one
document with a Student field and a Parent/Guardian field).

## Environment

| Variable | Purpose |
|---|---|
| `KEYSIGN_SIGNING_URL` | Base URL of the KeySign signing page. Never hardcoded. Unset = the `/waivers` page says "E-sign is not connected yet". |
| `KEYSIGN_WEBHOOK_SECRET` | Shared HMAC secret (min 16 characters). Unset = the webhook always answers 401 (fails closed). |
| `WAIVERS_ASSUMED_SIGNED` | Temporary (D-022). `true` shows roster people as "Signed (assumed for now)". |

## Signing link (LaunchPad → KeySign)

`GET /api/waivers/signing` builds the iframe URL from `KEYSIGN_SIGNING_URL` and adds query
parameters KeySign must carry and echo back. IDs only, no names or emails:

| Parameter | Meaning |
|---|---|
| `launchpadUserId` | UUID of the LaunchPad user opening the form |
| `waiverDocumentId` | UUID of the `waiver_documents` row |
| `signerRole` | `student` or `guardian` |
| `returnUrl` | `https://<app>/waivers/done`, where KeySign sends the browser after completion |

## Completion webhook (KeySign → LaunchPad)

`POST /api/webhooks/keysign` with header `x-keysign-signature: sha256=<hex>`, where the value
is the HMAC-SHA256 of the RAW request body using `KEYSIGN_WEBHOOK_SECRET`. Body:

```json
{
  "event": "document.completed",
  "signatureId": "sig_abc123",
  "completedAt": "2026-11-18T01:00:00Z",
  "pdfDriveId": "optional Drive file id",
  "metadata": {
    "launchpadUserId": "<uuid>",
    "waiverDocumentId": "<uuid>",
    "signerRole": "student | guardian (optional)"
  }
}
```

Responses: `200 {ok, duplicate}`, `401` bad or missing signature (or secret unset), `400` not
JSON, `422` unrecognised payload or unknown person/waiver. The handler does one insert and
logs IDs only.

## Data rules

- `waiver_signatures` is append-only. The unique triple `(waiver_document_id, user_id, source)`
  makes a repeat delivery a no-op.
- `source` is `keysign` (confirmed by the webhook) or `self_reported` (the "I already filled out
  the form" button). A KeySign row and a self-report can coexist; the derived status prefers
  the KeySign one.
- Waiver status is derived on every read (`waiverStatus()` in `packages/shared`), never stored.
  One signature by the student or by any linked guardian covers the student's waiver.
- Self-reports write an `audit_log` row (`waiver.self_reported`) so an admin can verify them.

## Status: what is and is not connected

- The seeded "Team waiver 2027" row (`waiver_documents`) now has its KeySign document ID in `keysign_document_id`. It was set as data with a one-off update, so no document ID is in source.
- **Still needed:** `KEYSIGN_SIGNING_URL`. The KeySign **admin** page for a document is not the signing link: it needs an admin login and cannot be embedded for signers. Get the document's public signing (share) link from KeySign and set it as `KEYSIGN_SIGNING_URL`, together with `KEYSIGN_WEBHOOK_SECRET`. Until then `/waivers` says e-sign is not connected.

