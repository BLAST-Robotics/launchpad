import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./load-env";

/**
 * Imports first name, last name and grade into the CURRENT season's roster.
 *
 *   bun run db:import-roster <path-to-roster.csv>
 *
 * Data minimisation: students are minors and this repository is public, so only the three
 * fields the claim flow needs are read. Phone numbers, emails, parents, areas and roles in
 * the source sheet are ignored. The CSV itself must stay outside the repo (`data/` and
 * `*.roster.csv` are gitignored). Output is counts only, never names.
 *
 * Idempotent: a person is matched on (season, lower(first), lower(last)). Updating never
 * touches claimed_by_user_id or status.
 */
const path = process.argv[2];
if (!path) {
  console.error("Usage: bun run db:import-roster <path-to-roster.csv>");
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}

/** RFC 4180-style parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const [header = [], ...records] = parseCsv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const col = (name: string) =>
  header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
const nameCol = col("Names");
const rosterCol = col("Roster?");
const gradeCol = col("Grade");
const duesCol = col("Dues?");
const invoiceCol = col("Invoice to be sent");
if (nameCol < 0 || rosterCol < 0 || gradeCol < 0) {
  console.error("CSV is missing one of the Names, Roster? or Grade columns.");
  process.exit(1);
}

type Dues = "paid" | "unpaid" | "unknown";
/**
 * Dues from the sheet: paid when `Dues?` is TRUE or the invoice column is exactly "paid";
 * unpaid when `Dues?` is FALSE; otherwise unknown. Free-text invoice notes ("s", "1 yr paid
 * (2nd yr due)") are deliberately not interpreted: they never turn a FALSE into paid.
 */
export function duesFrom(dues: string, invoice: string): Dues {
  const d = dues.trim().toUpperCase();
  if (d === "TRUE" || invoice.trim().toLowerCase() === "paid") return "paid";
  if (d === "FALSE") return "unpaid";
  return "unknown";
}

const people: { first: string; last: string; grade: string | null; dues: Dues }[] = [];
let skipped = 0;
for (const r of records) {
  const full = (r[nameCol] ?? "").trim().replace(/\s+/g, " ");
  const onRoster = (r[rosterCol] ?? "").trim().toUpperCase() === "TRUE";
  const cut = full.lastIndexOf(" ");
  if (!full || !onRoster || cut < 1) {
    skipped += 1;
    continue;
  }
  const grade = (r[gradeCol] ?? "").trim();
  people.push({
    first: full.slice(0, cut),
    last: full.slice(cut + 1),
    grade: grade || null,
    dues: duesFrom(
      duesCol >= 0 ? (r[duesCol] ?? "") : "",
      invoiceCol >= 0 ? (r[invoiceCol] ?? "") : "",
    ),
  });
}

const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
const db = drizzle(client);

try {
  const [season] = await db.execute<{ id: string }>(
    sql`select id from "seasons" where "is_current" = true limit 1`,
  );
  if (!season) throw new Error("No current season. Run db:seed first.");

  let inserted = 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const p of people) {
      const existing = await tx.execute<{ id: string }>(sql`
        select id from "roster_entries"
        where season_id = ${season.id}
          and lower(first_name) = lower(${p.first}) and lower(last_name) = lower(${p.last})
        limit 1`);
      const hit = existing[0];
      if (hit) {
        await tx.execute(sql`
          update "roster_entries" set grade = ${p.grade}, dues_status = ${p.dues}, updated_at = now() where id = ${hit.id}`);
        updated += 1;
      } else {
        await tx.execute(sql`
          insert into "roster_entries" (season_id, first_name, last_name, grade, dues_status)
          values (${season.id}, ${p.first}, ${p.last}, ${p.grade}, ${p.dues})`);
        inserted += 1;
      }
    }
  });
  const byDues = await db.execute<{ dues_status: string; n: number }>(
    sql`select dues_status, count(*)::int n from "roster_entries" where season_id = ${season.id} group by 1`,
  );
  console.log(`roster import: inserted ${inserted}, updated ${updated}, skipped ${skipped}`);
  console.log(`dues: ${byDues.map((r) => `${r.dues_status}=${r.n}`).join(" ")}`);
} finally {
  await client.end({ timeout: 5 });
}
