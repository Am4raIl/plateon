import { useEffect, useState, useRef } from "react";
import { API_URL, expire, tokenFor, type Scope } from "../api/client";
export type Connection = "conectado" | "reconectando" | "sem conexão";
export function createSseParser(
  onEvent: (event: string, data: string) => void,
) {
  let buffer = "";
  return (chunk: string) => {
    buffer = (buffer + chunk).replace(/\r\n/g, "\n");
    let index;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) onEvent(event, data.join("\n"));
    }
  };
}
export function connectSse(
  scope: Scope,
  path: string,
  onRefresh: () => void,
  onState: (s: Connection) => void,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const run = async () => {
    if (controller.signal.aborted) return;
    onState(attempt ? "reconectando" : "sem conexão");
    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${tokenFor(scope)}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        expire(scope);
        onState("sem conexão");
        return;
      }
      if (!response.ok || !response.body) throw Error("stream");
      onState("conectado");
      attempt = 0;
      onRefresh();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parse = createSseParser((event) => {
        if (event === "pedido" || event === "conectado") onRefresh();
      });
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        parse(decoder.decode(value, { stream: true }));
      }
    } catch {
      /* A reconexão sempre recupera um snapshot por HTTP. */
    }
    if (!controller.signal.aborted) {
      onState("reconectando");
      timeout = setTimeout(run, Math.min(30000, 1000 * 2 ** attempt++));
    }
  };
  void run();
  return () => {
    controller.abort();
    clearTimeout(timeout);
  };
}
export function useSse(scope: Scope, path: string | null, refresh: () => void) {
  const [state, setState] = useState<Connection>("sem conexão");
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!path) return;
    return connectSse(scope, path, () => callback.current(), setState);
  }, [scope, path]);
  return state;
}
