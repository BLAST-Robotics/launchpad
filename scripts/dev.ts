/**
 * Runs the API and the web dev server together.
 * Each child inherits stdio; Ctrl+C stops both.
 */
const children = [
  Bun.spawn(["bun", "--cwd", "apps/api", "run", "dev"], {
    cwd: `${import.meta.dir}/..`,
    stdio: ["inherit", "inherit", "inherit"],
  }),
  Bun.spawn(["bun", "--cwd", "apps/web", "run", "dev"], {
    cwd: `${import.meta.dir}/..`,
    stdio: ["inherit", "inherit", "inherit"],
  }),
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const results = await Promise.all(children.map((child) => child.exited));
shutdown(results.find((code) => code !== 0) ? 1 : 0);
