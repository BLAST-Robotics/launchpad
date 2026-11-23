// Import env first: a bad environment must fail at boot, not at the first request.

import { closeDb } from "@launchpad/db";
import { createApp } from "./app";
import { env } from "./env";
import { initSentry, logEvent } from "./observability";

initSentry();

const app = createApp();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

logEvent("api.listening", { url: server.url.toString(), env: env.NODE_ENV });

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logEvent("api.shutdown", { signal });
  server.stop(true);
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
