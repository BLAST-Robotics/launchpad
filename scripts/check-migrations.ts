import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CI guard: a schema edit must ship with its SQL.
 *
 * `drizzle-kit check` only validates the journal/migration folder. To detect a schema
 * change with no migration, generate once and see whether the journal grew; if it did,
 * throw the generated files away and fail. Nothing is ever committed by this script.
 */
const repoRoot = join(import.meta.dir, "..");
const dbDir = join(repoRoot, "packages", "db");
const journalPath = join(dbDir, "migrations", "meta", "_journal.json");

const env = {
  ...process.env,
  // Generation does not connect; the config only needs the variable to exist.
  DATABASE_URL_UNPOOLED:
    process.env.DATABASE_URL_UNPOOLED ?? "postgresql://ci:ci@localhost:5432/ci",
};

function run(args: string[]) {
  const result = Bun.spawnSync(args, { cwd: dbDir, env, stdio: ["ignore", "pipe", "pipe"] });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const check = run(["bun", "x", "drizzle-kit", "check"]);
if (check.exitCode !== 0) {
  fail(`drizzle-kit check failed:\n${check.stdout}\n${check.stderr}`);
}

const before = readFileSync(journalPath, "utf8");
const journalBefore = JSON.parse(before) as { entries: Array<{ tag: string; idx: number }> };

const generate = run(["bun", "x", "drizzle-kit", "generate", "--name", "__drift_check__"]);
if (generate.exitCode !== 0) {
  fail(`drizzle-kit generate failed:\n${generate.stdout}\n${generate.stderr}`);
}

const after = readFileSync(journalPath, "utf8");
if (after === before) {
  console.log("migrations are in sync with the schema");
  process.exit(0);
}

const journalAfter = JSON.parse(after) as { entries: Array<{ tag: string; idx: number }> };
const known = new Set(journalBefore.entries.map((entry) => entry.tag));

for (const entry of journalAfter.entries) {
  if (known.has(entry.tag)) continue;
  rmSync(join(dbDir, "migrations", `${entry.tag}.sql`), { force: true });
  rmSync(join(dbDir, "migrations", "meta", `${String(entry.idx).padStart(4, "0")}_snapshot.json`), {
    force: true,
  });
}

// Restore the journal exactly; the drift migration must not be committed.
writeFileSync(journalPath, before);

fail(
  "Schema drift: the Drizzle schema has changes with no committed migration.\n" +
    "Run `bun run db:generate`, review the SQL, and commit it with the schema change.",
);
