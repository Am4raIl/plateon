import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";
import { resetDatabase } from "./mocks/handlers";
import { transferableAbortController } from "node:util";
// Node 24 fetch requires its own AbortSignal rather than jsdom's DOM implementation.
const native = transferableAbortController();
vi.stubGlobal("AbortController", native.constructor);
vi.stubGlobal("AbortSignal", native.signal.constructor);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDatabase();
  sessionStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());
