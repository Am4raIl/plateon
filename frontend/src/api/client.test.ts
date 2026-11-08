import { http, HttpResponse } from "msw";
import {
  ApiError,
  API_URL,
  friendlyError,
  publicApi,
  staffApi,
  tabletApi,
} from "./client";
import { server } from "../test/mocks/server";
import { useSession } from "../app/store";
beforeEach(() => {
  useSession.getState().setStaff({
    token: "equipe-secreta",
    papel: "GERENTE",
    expiraEm: new Date(Date.now() + 60000).toISOString(),
    username: "diego",
  });
  useSession.getState().setTablet("tablet-secreto");
});
it.each([
  ["/admin/probe", staffApi, "equipe-secreta"],
  ["/mesa/probe", tabletApi, "tablet-secreto"],
  ["/public/probe", publicApi, null],
] as const)("isola credenciais em %s", async (path, api, token) => {
  let header: string | null = null;
  server.use(
    http.get(`${API_URL}${path}`, ({ request }) => {
      header = request.headers.get("Authorization");
      return HttpResponse.json({ ok: true });
    }),
  );
  await api(path);
  expect(header).toBe(token ? `Bearer ${token}` : null);
});
it("envia somente o corpo recebido e não repete escrita após falha", async () => {
  let calls = 0;
  let input: unknown;
  server.use(
    http.post(`${API_URL}/probe`, async ({ request }) => {
      calls++;
      input = await request.json();
      expect(request.headers.get("Content-Type")).toBe("application/json");
      return new HttpResponse(null, { status: 500 });
    }),
  );
  await expect(
    staffApi("/probe", "POST", { disponivel: false }),
  ).rejects.toBeInstanceOf(ApiError);
  expect(input).toEqual({ disponivel: false });
  expect(calls).toBe(1);
});
it.each([400, 401, 403, 404, 409, 410, 422, 429, 500])(
  "normaliza erro %s sem expor detalhes técnicos",
  async (status) => {
    server.use(
      http.get(`${API_URL}/probe`, () =>
        HttpResponse.json(
          { status, detail: "jdbc.SQLException secret endpoint" },
          { status, headers: { "Retry-After": "7" } },
        ),
      ),
    );
    let result: unknown;
    try {
      await staffApi("/probe");
    } catch (e) {
      result = e;
    }
    expect(result).toBeInstanceOf(ApiError);
    expect((result as ApiError).status).toBe(status);
    expect(friendlyError(result)).not.toContain("SQL");
    if (status === 429) expect((result as ApiError).retryAfter).toBe(7);
  },
);
it("expira somente a sessão usada", async () => {
  server.use(
    http.get(`${API_URL}/probe`, () => new HttpResponse(null, { status: 401 })),
  );
  await expect(tabletApi("/probe")).rejects.toBeInstanceOf(ApiError);
  expect(useSession.getState().tablet).toBeNull();
  expect(useSession.getState().staff).not.toBeNull();
  await expect(staffApi("/probe")).rejects.toBeInstanceOf(ApiError);
  expect(useSession.getState().staff).toBeNull();
});
it("aceita resposta vazia da comanda sem inventar valores", async () => {
  server.use(http.get(`${API_URL}/mesa/comanda`, () => new HttpResponse(null)));
  expect(await tabletApi("/mesa/comanda")).toBeUndefined();
});
it("rejeita fechamento com valores ausentes", async () => {
  server.use(
    http.post(`${API_URL}/admin/comandas/conta/fechar`, () =>
      HttpResponse.json({ comanda: { total: 100 }, troco: 0 }),
    ),
  );
  await expect(
    staffApi("/admin/comandas/conta/fechar", "POST", { pagamentos: [] }),
  ).rejects.toBeInstanceOf(ApiError);
});
it("normaliza falha de rede", async () => {
  server.use(http.get(`${API_URL}/probe`, () => HttpResponse.error()));
  await expect(staffApi("/probe")).rejects.toMatchObject({ status: 0 });
});
