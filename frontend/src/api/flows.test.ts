import { staffApi, tabletApi, publicApi } from "./client";
import { useSession } from "../app/store";
import { ids, product } from "../test/mocks/fixtures";
import type {
  ComandaView,
  FechamentoView,
  PedidoView,
  SolicitacaoPareamento,
} from "./types";
beforeEach(() => {
  useSession.getState().setTablet("mock-tablet");
  useSession.getState().setStaff({
    token: "mock-GERENTE",
    papel: "GERENTE",
    username: "diego",
    expiraEm: new Date(Date.now() + 60000).toISOString(),
  });
});
it("pareia e entrega o token uma única vez", async () => {
  const pair = await publicApi<SolicitacaoPareamento>(
    "/dispositivos/pareamento",
    "POST",
  );
  expect(
    await publicApi(`/dispositivos/pareamento/${pair.solicitacaoId}`),
  ).toEqual({ status: "PENDENTE", token: null });
  await staffApi("/admin/dispositivos/pareamento/aprovar", "POST", {
    codigo: pair.codigo,
    mesaId: ids.table,
  });
  expect(
    await publicApi(`/dispositivos/pareamento/${pair.solicitacaoId}`),
  ).toEqual({ status: "CONSUMIDA", token: "mock-tablet" });
  await expect(
    publicApi(`/dispositivos/pareamento/${pair.solicitacaoId}`),
  ).rejects.toMatchObject({ status: 410 });
});
it("cria rascunho, adiciona e envia de forma idempotente", async () => {
  const draft = await tabletApi<PedidoView>("/mesa/pedidos", "POST");
  const edited = await tabletApi<PedidoView>(
    `/mesa/pedidos/${draft.id}/itens`,
    "POST",
    { produtoId: product.id, quantidade: 1, adicionaisIds: [], observacao: "" },
  );
  expect(edited.subtotal).toBe(76);
  const sent = await tabletApi<PedidoView>(
    `/mesa/pedidos/${draft.id}/enviar`,
    "POST",
    { observacaoGeral: "" },
  );
  const resend = await tabletApi<PedidoView>(
    `/mesa/pedidos/${draft.id}/enviar`,
    "POST",
    { observacaoGeral: "" },
  );
  expect(resend.id).toBe(sent.id);
  expect(resend.numeroDiario).toBe(sent.numeroDiario);
});
it("duas versões não sobrescrevem o mesmo pedido", async () => {
  const body = { novoStatus: "EM_PREPARO", versao: 2, motivo: null };
  await staffApi(`/admin/kanban/${ids.order}/status`, "PATCH", body);
  await expect(
    staffApi(`/admin/kanban/${ids.order}/status`, "PATCH", body),
  ).rejects.toMatchObject({ status: 409 });
});
it("só fecha com pedidos entregues e pagamentos exatos", async () => {
  await expect(
    staffApi(`/admin/comandas/${ids.bill}/fechar`, "POST", {
      pagamentos: [],
      removerTaxa: false,
      forcar: false,
    }),
  ).rejects.toMatchObject({ status: 422 });
  let p: PedidoView;
  for (const [i, status] of ["EM_PREPARO", "PRONTO", "ENTREGUE"].entries())
    p = await staffApi(`/admin/kanban/${ids.order}/status`, "PATCH", {
      novoStatus: status,
      motivo: null,
      versao: 2 + i,
    });
  expect(p!.status).toBe("ENTREGUE");
  const prepared = await staffApi<FechamentoView>(
    `/admin/comandas/${ids.bill}/fechar`,
    "POST",
    { pagamentos: [], removerTaxa: false, forcar: false },
  );
  expect(prepared.comanda.status).toBe("AGUARDANDO_PAGAMENTO");
  await expect(tabletApi("/mesa/pedidos", "POST")).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    staffApi(`/admin/comandas/${ids.bill}/fechar`, "POST", {
      pagamentos: [{ forma: "PIX", valor: 1 }],
      removerTaxa: false,
      forcar: false,
    }),
  ).rejects.toMatchObject({ status: 422 });
  const current = await staffApi<ComandaView>(`/admin/comandas/${ids.bill}`);
  expect(current.status).toBe("AGUARDANDO_PAGAMENTO");
  const paid = await staffApi<FechamentoView>(
    `/admin/comandas/${ids.bill}/fechar`,
    "POST",
    {
      pagamentos: [
        {
          forma: "DINHEIRO",
          valor: prepared.comanda.total,
          valorRecebido: 100,
        },
      ],
      removerTaxa: false,
      forcar: false,
    },
  );
  expect(paid.comanda.status).toBe("PAGA");
  expect(paid.troco).toBeCloseTo(4.4);
  expect(await tabletApi("/mesa/comanda")).toBeUndefined();
});
