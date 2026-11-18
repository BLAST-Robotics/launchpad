/**
 * Minimal CSV support for the admin roster import. Pure: no I/O, no framework.
 *
 * Mirrors packages/db/scripts/import-roster.ts, which keeps its own copy because the db
 * package deliberately has no dependency on this one.
 */

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

export interface ImportedPerson {
  firstName: string;
  lastName: string;
  grade: string | null;
}

export interface ParsedRosterCsv {
  people: ImportedPerson[];
  skipped: number;
}

export class RosterCsvError extends Error {}

const MAX_ROWS = 500;

/**
 * Accepts either the team sheet (`Names`, optional `Roster?`, `Grade`) or a plain
 * `First Name`, `Last Name`, `Grade` file. Only those three fields are read; every other
 * column is ignored, so phone numbers and emails in a source sheet never reach the server's
 * business logic. Grades outside 1-12 import as blank.
 */
export function parseRosterCsv(text: string): ParsedRosterCsv {
  const [header = [], ...records] = parseCsv(text.replace(/^﻿/, ""));
  const col = (...names: string[]) =>
    header.findIndex((h) => names.includes(h.trim().toLowerCase()));

  const firstCol = col("first name", "firstname", "first");
  const lastCol = col("last name", "lastname", "last");
  const namesCol = col("names", "name");
  const rosterCol = col("roster?");
  const gradeCol = col("grade");

  const split = firstCol >= 0 && lastCol >= 0;
  if (!split && namesCol < 0) {
    throw new RosterCsvError("The CSV needs a Names column, or First Name and Last Name columns.");
  }
  if (records.length > MAX_ROWS) {
    throw new RosterCsvError(`Import at most ${MAX_ROWS} rows at a time.`);
  }

  const people: ImportedPerson[] = [];
  let skipped = 0;
  for (const r of records) {
    if (r.every((c) => c.trim() === "")) continue;

    let first = "";
    let last = "";
    if (split) {
      first = (r[firstCol] ?? "").trim().replace(/\s+/g, " ");
      last = (r[lastCol] ?? "").trim().replace(/\s+/g, " ");
    } else {
      const full = (r[namesCol] ?? "").trim().replace(/\s+/g, " ");
      const cut = full.lastIndexOf(" ");
      if (cut > 0) {
        first = full.slice(0, cut);
        last = full.slice(cut + 1);
      }
    }

    const onRoster = rosterCol < 0 || (r[rosterCol] ?? "").trim().toUpperCase() === "TRUE";
    if (!first || !last || !onRoster || first.length > 60 || last.length > 60) {
      skipped += 1;
      continue;
    }

    const rawGrade = gradeCol >= 0 ? (r[gradeCol] ?? "").trim() : "";
    const grade = /^(?:[1-9]|1[0-2])$/.test(rawGrade) ? rawGrade : null;
    people.push({ firstName: first, lastName: last, grade });
  }
  return { people, skipped };
}
