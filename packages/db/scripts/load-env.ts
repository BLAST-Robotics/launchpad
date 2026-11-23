import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Drizzle Kit and the migration scripts run with cwd = packages/db, so Bun's automatic
 * `.env.local` loading would look in the wrong directory. Walk up from cwd to the repo
 * root, then load the files without overriding anything already set by the shell, CI or
 * Vercel.
 *
 * `import.meta.dir` is deliberately not used: Drizzle Kit bundles the config file and
 * does not provide it.
 */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(dir, ".env.local")) || existsSync(join(dir, ".env"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const repoRoot = findRepoRoot(process.cwd());

for (const file of [".env.local", ".env"]) {
  const path = join(repoRoot, file);
  if (!existsSync(path)) continue;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
