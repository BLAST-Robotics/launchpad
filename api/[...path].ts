import { createApp } from "../apps/api/src/app";

/**
 * Vercel catch-all: every /api/* request is the same Elysia app `bun dev` runs.
 * Vercel's Bun runtime accepts a Bun.serve-style default export.
 */
const app = createApp();

export default {
  fetch(request: Request): Promise<Response> {
    return app.handle(request);
  },
};
