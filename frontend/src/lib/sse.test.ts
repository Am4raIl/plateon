import { createSseParser, connectSse } from "./sse";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { API_URL } from "../api/client";
import { useSession } from "../app/store";
it("ignora heartbeat e aceita mensagens em pedaços", () => {
  const event = vi.fn();
  const parse = createSseParser(event);
  parse(":heartbeat\n\nevent: pedido\nda");
  parse('ta: {"pedidoId":"um"}\n\n');
  expect(event).toHaveBeenCalledExactlyOnceWith("pedido", '{"pedidoId":"um"}');
});
it("aceita CRLF dividido entre chunks e dados de várias linhas", () => {
  const event = vi.fn();
  const parse = createSseParser(event);
  parse("event: conectado\r");
  parse('\ndata: {\r\ndata: "ok":true}\r\n\r');
  parse("\n");
  expect(event).toHaveBeenCalledWith("conectado", '{\n"ok":true}');
});
it("recupera snapshot em cada conexão e evento", async () => {
  useSession.getState().setStaff({
    token: "mock-GERENTE",
    papel: "GERENTE",
    expiraEm: new Date(Date.now() + 60000).toISOString(),
    username: "diego",
  });
  server.use(
    http.get(
      `${API_URL}/stream`,
      () =>
        new HttpResponse(
          "event: conectado\ndata: {}\n\nevent: pedido\ndata: {}\n\n",
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    ),
  );
  const refresh = vi.fn();
  const state = vi.fn();
  const close = connectSse("staff", "/stream", refresh, state);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));
  expect(state).toHaveBeenCalledWith("conectado");
  expect(state).toHaveBeenCalledWith("reconectando");
  close();
});
it("interrompe e limpa autenticação em acesso recusado", async () => {
  useSession.getState().setTablet("mock-tablet");
  server.use(
    http.get(
      `${API_URL}/stream`,
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  const close = connectSse("tablet", "/stream", vi.fn(), vi.fn());
  await vi.waitFor(() => expect(useSession.getState().tablet).toBeNull());
  close();
});
