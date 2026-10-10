// Cloudflare Workers entry for the ClawPhunks Express app (replaces Vercel @vercel/node).
// server.ts calls app.listen(PORT); httpServerHandler bridges fetch -> that Node HTTP server.
import { httpServerHandler } from "cloudflare:node";
import axios from "axios";
import "../src/server";

const handler = httpServerHandler({ port: parseInt(process.env.PORT ?? "3000", 10) });

// x402-express calls the self-hosted facilitator (FACILITATOR_URL, i.e. this same Worker) over HTTP via axios.
// A Worker cannot fetch its own workers.dev hostname (404), so dispatch same-host requests in-process.
let current: { env: unknown; ctx: ExecutionContext } | null = null;
const selfHost = (() => {
  try { return new URL(process.env.FACILITATOR_URL ?? "").host; } catch { return ""; }
})();
const selfAwareFetch: typeof fetch = (input, init) => {
  const req = new Request(input as RequestInfo, init);
  if (selfHost && current && new URL(req.url).host === selfHost) {
    return (handler as any).fetch(req, current.env, current.ctx);
  }
  return fetch(req);
};
axios.defaults.adapter = "fetch";
axios.defaults.env = { ...(axios.defaults.env ?? {}), fetch: selfAwareFetch } as any;

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    current = { env, ctx };
    return (handler as any).fetch(request, env, ctx);
  },
} satisfies ExportedHandler;
