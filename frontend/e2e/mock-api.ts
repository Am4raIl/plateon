import { createServer } from "node:http";
import { server } from "../src/test/mocks/server";
import { resetDatabase } from "../src/test/mocks/handlers";
// Bridge the same MSW contracts over HTTP so separate browsers share restaurant state.
server.listen({ onUnhandledRequest: "bypass" });
let failure: { path: string; status: number; times: number } | null = null;
const httpServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Expose-Headers", "Retry-After");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/__test/health") {
    res.end("ok");
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  if (req.url === "/__test/reset") {
    resetDatabase();
    failure = null;
    res.end("ok");
    return;
  }
  if (req.url === "/__test/fail") {
    failure = JSON.parse(body.toString());
    res.end("ok");
    return;
  }
  if (
    failure &&
    failure.times > 0 &&
    req.url?.startsWith(failure.path) &&
    req.method !== "GET"
  ) {
    failure.times--;
    res.writeHead(failure.status, {
      "Content-Type": "application/problem+json",
      "Retry-After": "1",
    });
    res.end(JSON.stringify({ status: failure.status }));
    return;
  }
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  try {
    const response = await fetch(`http://localhost:8081${req.url}`, {
      method: req.method,
      headers: {
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
        ...(body.length ? { "Content-Type": "application/json" } : {}),
      },
      ...(body.length ? { body } : {}),
      signal: controller.signal,
    });
    res.statusCode = response.status;
    response.headers.forEach((v, k) => {
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(k)
      )
        res.setHeader(k, v);
    });
    if (response.body) {
      const reader = response.body.getReader();
      while (!res.destroyed) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch {
    if (!res.destroyed) {
      res.writeHead(500, { "Content-Type": "application/problem+json" });
      res.end(JSON.stringify({ status: 500 }));
    }
  }
});
httpServer.listen(8082, "127.0.0.1", () =>
  process.stdout.write("Test API ready at http://127.0.0.1:8082\n"),
);
const stop = () => {
  server.close();
  httpServer.close();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
