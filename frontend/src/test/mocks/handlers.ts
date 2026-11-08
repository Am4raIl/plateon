import { http, HttpResponse } from "msw";
import type {
  AdicionalView,
  ChamadoAdminView,
  ComandaView,
  DispositivoView,
  ItemInput,
  MesaView,
  Pagamento,
  Papel,
  ProdutoView,
  StatusPedido,
  UsuarioView,
} from "../../api/types";
import {
  dashboard,
  device,
  extra,
  ids,
  makeBill,
  makeCalls,
  product,
  tables,
  user,
} from "./fixtures";
import { nextStatus } from "../../app/permissions";
const base = "http://localhost:8081/api/v1";
type Database = {
  products: ProdutoView[];
  extras: AdicionalView[];
  tables: MesaView[];
  users: UsuarioView[];
  devices: DispositivoView[];
  bills: ComandaView[];
  calls: ChamadoAdminView[];
  pairings: Record<
    string,
    { codigo: string; expiraEm: string; approved: boolean; consumed: boolean }
  >;
  nextNumber: number;
  couvert: number;
  originalCharges: Record<string, { taxa: number; couvert: number }>;
};
let db: Database;
const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
export function resetDatabase() {
  db = {
    products: [
      structuredClone(product),
      {
        ...structuredClone(product),
        id: "11111111-1111-4111-8111-111111111112",
        nome: "Rigatoni ao limão siciliano",
        descricao: "Creme leve, raspas de limão e parmesão.",
        preco: 62,
        disponivel: false,
      },
    ],
    extras: [structuredClone(extra)],
    tables: structuredClone(tables),
    users: [structuredClone(user)],
    devices: [structuredClone(device)],
    bills: [makeBill()],
    calls: makeCalls(),
    pairings: {},
    nextNumber: 17,
    couvert: 0,
    originalCharges: {},
  };
}
resetDatabase();
const problem = (status: number, detail = "Ação não permitida") =>
  HttpResponse.json(
    { type: "about:blank", title: detail, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const emit = (id: string, status: string) => {
  const text = new TextEncoder().encode(
    `event: pedido\ndata: ${JSON.stringify({ pedidoId: id, status })}\n\n`,
  );
  for (const controller of streams) {
    try {
      controller.enqueue(text);
    } catch {
      streams.delete(controller);
    }
  }
};
function recalc(bill: ComandaView) {
  bill.subtotal = bill.pedidos
    .filter((p) => !["RASCUNHO", "CANCELADO"].includes(p.status))
    .reduce((s, p) => s + p.subtotal, 0);
  bill.taxaServico =
    Math.round(bill.subtotal * bill.taxaServicoPercentual) / 100;
  bill.total =
    Math.round((bill.subtotal + bill.taxaServico + bill.couvert) * 100) / 100;
}
function page<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const pagina = Number(url.searchParams.get("pagina") ?? 0);
  const tamanho = Number(url.searchParams.get("tamanho") ?? 20);
  return {
    itens: items.slice(pagina * tamanho, (pagina + 1) * tamanho),
    pagina,
    tamanho,
    totalItens: items.length,
    totalPaginas: Math.ceil(items.length / tamanho),
    temProxima: (pagina + 1) * tamanho < items.length,
  };
}
const activeBill = () =>
  db.bills.find((c) => ["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(c.status));
const order = (id: string) =>
  db.bills.flatMap((c) => c.pedidos).find((p) => p.id === id);
function authorized(request: Request, roles?: Papel[]) {
  const auth = request.headers.get("Authorization");
  if (!auth || auth.includes("expired")) return problem(401);
  if (auth === "Bearer mock-tablet" && !db.devices.some((d) => d.ativo))
    return problem(401);
  if (roles && !roles.some((r) => auth.includes(r))) return problem(403);
  return null;
}
export const handlers = [
  http.post(`${base}/auth/login`, async ({ request }) => {
    const v = (await request.json()) as { username: string; senha: string };
    if (v.senha !== "dev12345678") return problem(401);
    if (!/cozinha|garcom|gerente/.test(v.username)) return problem(401);
    const role: Papel = v.username.includes("cozinha")
      ? "COZINHA"
      : v.username.includes("garcom")
        ? "GARCOM"
        : "GERENTE";
    return HttpResponse.json({
      token: `mock-${role}`,
      expiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
      papel: role,
    });
  }),
  http.post(`${base}/dispositivos/pareamento`, () => {
    const id = crypto.randomUUID();
    const expiraEm = new Date(Date.now() + 600000).toISOString();
    db.pairings[id] = {
      codigo: "ABC234",
      expiraEm,
      approved: false,
      consumed: false,
    };
    return HttpResponse.json({ solicitacaoId: id, codigo: "ABC234", expiraEm });
  }),
  http.get(`${base}/dispositivos/pareamento/:id`, ({ params }) => {
    const pair = db.pairings[String(params.id)];
    if (!pair || pair.consumed || Date.parse(pair.expiraEm) < Date.now())
      return problem(410);
    if (pair.approved) {
      pair.consumed = true;
      return HttpResponse.json({ status: "CONSUMIDA", token: "mock-tablet" });
    }
    return HttpResponse.json({ status: "PENDENTE", token: null });
  }),
  http.post(`${base}/mesa/desparear`, ({ request }) => {
    const denied = authorized(request);
    if (denied) return denied;
    const current = db.devices.find((d) => d.ativo);
    if (!current) return problem(404);
    current.ativo = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(
    `${base}/admin/dispositivos/pareamento/aprovar`,
    async ({ request }) => {
      const denied = authorized(request, ["GARCOM", "GERENTE"]);
      if (denied) return denied;
      const v = (await request.json()) as { codigo: string; mesaId: string };
      const pair = Object.values(db.pairings).find(
        (p) => p.codigo === v.codigo && !p.consumed,
      );
      if (!pair) return problem(410);
      pair.approved = true;
      if (!db.devices.some((d) => d.ativo && d.mesaId === v.mesaId)) {
        const table = db.tables.find((t) => t.id === v.mesaId);
        if (table)
          db.devices.push({
            ...structuredClone(device),
            id: crypto.randomUUID(),
            mesaId: table.id,
            numeroMesa: table.numero,
            ativo: true,
          });
      }
      return HttpResponse.json({ ...device, mesaId: v.mesaId });
    },
  ),
  http.get(
    `${base}/mesa/estado`,
    ({ request }) =>
      authorized(request) ??
      HttpResponse.json({
        estado:
          activeBill()?.status === "AGUARDANDO_PAGAMENTO"
            ? "AGUARDANDO_PAGAMENTO"
            : activeBill()
              ? "EM_ATENDIMENTO"
              : "LIVRE",
        numeroMesa: 7,
      }),
  ),
  http.get(
    `${base}/mesa/cardapio`,
    ({ request }) =>
      authorized(request) ??
      HttpResponse.json(
        db.products
          .filter((p) => p.ativo)
          .map((p) => ({
            ...p,
            adicionaisDisponiveis: db.extras.filter(
              (a) => a.ativo && a.categorias.includes(p.categoria),
            ),
          })),
      ),
  ),
  http.get(
    `${base}/mesa/comanda`,
    ({ request }) =>
      authorized(request) ??
      (activeBill() ? HttpResponse.json(activeBill()) : new HttpResponse(null)),
  ),
  http.post(`${base}/mesa/pedidos`, ({ request }) => {
    const denied = authorized(request);
    if (denied) return denied;
    let c = activeBill();
    if (c?.status === "AGUARDANDO_PAGAMENTO") return problem(409);
    if (!c) {
      c = {
        ...makeBill(),
        id: crypto.randomUUID(),
        pedidos: [],
        subtotal: 0,
        taxaServico: 0,
        total: 12,
      };
      db.bills.push(c);
    }
    let p = c.pedidos.find((p) => p.status === "RASCUNHO");
    if (!p) {
      p = {
        id: crypto.randomUUID(),
        comandaId: c.id,
        status: "RASCUNHO",
        numeroDiario: null,
        diaOperacional: null,
        observacaoGeral: null,
        criadoEm: new Date().toISOString(),
        enviadoEm: null,
        versao: 0,
        itens: [],
        subtotal: 0,
      };
      c.pedidos.push(p);
    }
    return HttpResponse.json(p);
  }),
  http.post(`${base}/mesa/pedidos/:id/itens`, async ({ params, request }) => {
    const p = order(String(params.id));
    if (!p) return problem(404);
    if (
      p.status !== "RASCUNHO" ||
      activeBill()?.status === "AGUARDANDO_PAGAMENTO"
    )
      return problem(409);
    const v = (await request.json()) as ItemInput;
    const pr = db.products.find((p) => p.id === v.produtoId);
    if (!pr?.disponivel) return problem(422);
    const adicionais = db.extras.filter((a) => v.adicionaisIds.includes(a.id));
    p.itens.push({
      id: crypto.randomUUID(),
      produtoId: pr.id,
      nomeProduto: pr.nome,
      quantidade: v.quantidade,
      observacao: v.observacao,
      precoUnitario: pr.preco,
      estacao: pr.estacao,
      adicionais,
      subtotal:
        (pr.preco + adicionais.reduce((s, a) => s + a.preco, 0)) * v.quantidade,
    });
    p.subtotal = p.itens.reduce((s, i) => s + i.subtotal, 0);
    p.versao++;
    return HttpResponse.json(p);
  }),
  http.patch(
    `${base}/mesa/pedidos/:id/itens/:itemId`,
    async ({ params, request }) => {
      const p = order(String(params.id));
      if (!p) return problem(404);
      if (
        p.status !== "RASCUNHO" ||
        activeBill()?.status === "AGUARDANDO_PAGAMENTO"
      )
        return problem(409);
      const item = p.itens.find((i) => i.id === params.itemId);
      if (!item) return problem(404);
      const v = (await request.json()) as ItemInput;
      item.quantidade = v.quantidade;
      item.observacao = v.observacao;
      item.adicionais = db.extras.filter((a) => v.adicionaisIds.includes(a.id));
      item.subtotal =
        (item.precoUnitario +
          item.adicionais.reduce((s, a) => s + a.preco, 0)) *
        v.quantidade;
      p.subtotal = p.itens.reduce((s, i) => s + i.subtotal, 0);
      p.versao++;
      return HttpResponse.json(p);
    },
  ),
  http.delete(`${base}/mesa/pedidos/:id/itens/:itemId`, ({ params }) => {
    const p = order(String(params.id));
    if (!p) return problem(404);
    if (
      p.status !== "RASCUNHO" ||
      activeBill()?.status === "AGUARDANDO_PAGAMENTO"
    )
      return problem(409);
    p.itens = p.itens.filter((i) => i.id !== params.itemId);
    p.subtotal = p.itens.reduce((s, i) => s + i.subtotal, 0);
    p.versao++;
    return HttpResponse.json(p);
  }),
  http.post(`${base}/mesa/pedidos/:id/enviar`, async ({ params, request }) => {
    const p = order(String(params.id));
    if (!p) return problem(404);
    if (p.status !== "RASCUNHO") return HttpResponse.json(p);
    if (!p.itens.length) return problem(422);
    if (activeBill()?.status === "AGUARDANDO_PAGAMENTO") return problem(409);
    const input = (await request.json()) as { observacaoGeral: string };
    p.status = "RECEBIDO";
    p.numeroDiario = db.nextNumber++;
    p.diaOperacional = "2026-11-07";
    p.enviadoEm = new Date().toISOString();
    p.observacaoGeral = input.observacaoGeral;
    p.versao++;
    recalc(activeBill()!);
    emit(p.id, p.status);
    return HttpResponse.json(p);
  }),
  http.post(`${base}/mesa/chamados`, async ({ request }) => {
    const input = (await request.json()) as { tipo: ChamadoAdminView["tipo"] };
    if (
      db.calls.some(
        (c) =>
          c.numeroMesa === 7 && c.tipo === input.tipo && c.status === "ABERTO",
      )
    )
      return problem(409);
    const c: ChamadoAdminView = {
      id: crypto.randomUUID(),
      tipo: input.tipo,
      status: "ABERTO",
      criadoEm: new Date().toISOString(),
      atendidoEm: null,
      numeroMesa: 7,
      comandaId: activeBill()?.id ?? null,
    };
    db.calls.push(c);
    return HttpResponse.json(c);
  }),
  http.get(`${base}/admin/kanban`, ({ request }) => {
    const denied = authorized(request, ["COZINHA", "GARCOM", "GERENTE"]);
    if (denied) return denied;
    const station = new URL(request.url).searchParams.get("estacao");
    const cards = db.bills.flatMap((c) =>
      c.pedidos
        .filter((p) => !station || p.itens.some((i) => i.estacao === station))
        .map((p) => ({
          pedido: p,
          numeroMesa: c.numeroMesa,
          minutosDecorridos: 28,
          atrasado: p.status !== "PRONTO",
        })),
    );
    return HttpResponse.json({
      recebido: cards.filter((c) => c.pedido.status === "RECEBIDO"),
      emPreparo: cards.filter((c) => c.pedido.status === "EM_PREPARO"),
      pronto: cards.filter((c) => c.pedido.status === "PRONTO"),
    });
  }),
  http.patch(`${base}/admin/kanban/:id/status`, async ({ params, request }) => {
    const denied = authorized(request, ["COZINHA", "GARCOM", "GERENTE"]);
    if (denied) return denied;
    const p = order(String(params.id));
    if (!p) return problem(404);
    const v = (await request.json()) as {
      novoStatus: StatusPedido;
      versao: number;
      motivo?: string;
    };
    if (p.versao !== v.versao) return problem(409);
    if (v.novoStatus !== nextStatus(p.status) && !v.motivo) return problem(422);
    p.status = v.novoStatus;
    p.versao++;
    emit(p.id, p.status);
    const c = db.bills.find((c) => c.id === p.comandaId);
    if (c) recalc(c);
    return HttpResponse.json(p);
  }),
  http.get(`${base}/admin/chamados`, ({ request }) => {
    const denied = authorized(request, ["GARCOM", "GERENTE"]);
    if (denied) return denied;
    const status = new URL(request.url).searchParams.get("status");
    return HttpResponse.json(
      page(
        db.calls.filter((c) => !status || c.status === status),
        request,
      ),
    );
  }),
  http.patch(`${base}/admin/chamados/:id`, ({ params }) => {
    const c = db.calls.find((c) => c.id === params.id);
    if (!c) return problem(404);
    if (c.status === "ATENDIDO") return problem(409);
    if (
      c.tipo === "CONTA" &&
      db.bills.some(
        (b) =>
          b.numeroMesa === c.numeroMesa &&
          ["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(b.status),
      )
    )
      return problem(409);
    c.status = "ATENDIDO";
    c.atendidoEm = new Date().toISOString();
    return HttpResponse.json(c);
  }),
  http.get(`${base}/admin/comandas/resumos`, ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") ?? "ATIVAS";
    return HttpResponse.json(
      page(
        db.bills
          .filter((c) =>
            status === "ATIVAS"
              ? ["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(c.status)
              : c.status === status,
          )
          .map(
            ({
              id,
              status,
              numeroMesa,
              abertaEm,
              pedidos,
              subtotal,
              taxaServico,
              total,
            }) => ({
              id,
              status,
              numeroMesa,
              abertaEm,
              atualizadaEm: pedidos.reduce(
                (latest, p) =>
                  p.enviadoEm && p.enviadoEm > latest ? p.enviadoEm : latest,
                abertaEm,
              ),
              subtotal,
              taxaServico,
              total,
            }),
          ),
        request,
      ),
    );
  }),
  http.get(`${base}/admin/comandas/:id`, ({ params }) => {
    const c = db.bills.find((c) => c.id === params.id);
    return c ? HttpResponse.json(c) : problem(404);
  }),
  http.post(`${base}/admin/comandas`, () =>
    HttpResponse.json(activeBill() ?? db.bills[0]),
  ),
  http.post(
    `${base}/admin/comandas/:id/fechar`,
    async ({ params, request }) => {
      const denied = authorized(request, ["GARCOM", "GERENTE"]);
      if (denied) return denied;
      const c = db.bills.find((c) => c.id === params.id);
      if (!c) return problem(404);
      const v = (await request.json()) as {
        pagamentos: Pagamento[];
        removerTaxa: boolean;
        removerCouvert: boolean;
        forcar: boolean;
      };
      if (!["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(c.status))
        return problem(409);
      if (
        v.forcar &&
        !request.headers.get("Authorization")?.includes("GERENTE")
      )
        return problem(403);
      if (
        c.pedidos.some(
          (p) => !["ENTREGUE", "CANCELADO", "RASCUNHO"].includes(p.status),
        ) &&
        !v.forcar
      )
        return problem(422);
      const next = structuredClone(c);
      if ((v.removerTaxa || v.removerCouvert) && !db.originalCharges[c.id])
        db.originalCharges[c.id] = {
          taxa: c.taxaServicoPercentual,
          couvert: c.couvert,
        };
      if (v.removerTaxa) next.taxaServicoPercentual = 0;
      if (v.removerCouvert) next.couvert = 0;
      recalc(next);
      if (
        v.pagamentos.length &&
        Math.round(v.pagamentos.reduce((s, p) => s + p.valor, 0) * 100) !==
          Math.round(next.total * 100)
      )
        return problem(422);
      if (
        v.pagamentos.some(
          (payment) =>
            payment.forma === "DINHEIRO" &&
            (payment.valorRecebido ?? payment.valor) < payment.valor,
        )
      )
        return problem(422);
      next.status = v.pagamentos.length ? "PAGA" : "AGUARDANDO_PAGAMENTO";
      if (next.status === "PAGA")
        next.pedidos.forEach((p) => {
          if (p.status === "RASCUNHO") p.status = "CANCELADO";
        });
      Object.assign(c, next);
      if (next.status === "PAGA") delete db.originalCharges[c.id];
      if (next.status === "PAGA")
        db.devices.forEach((d) => {
          if (d.ativo && d.numeroMesa === next.numeroMesa) d.ativo = false;
        });
      if (next.status === "PAGA")
        db.calls.forEach((call) => {
          if (
            call.tipo === "CONTA" &&
            call.numeroMesa === next.numeroMesa &&
            call.status === "ABERTO"
          ) {
            call.status = "ATENDIDO";
            call.atendidoEm = new Date().toISOString();
          }
        });
      const troco = v.pagamentos.reduce(
        (s, p) =>
          s +
          (p.forma === "DINHEIRO" ? (p.valorRecebido ?? p.valor) - p.valor : 0),
        0,
      );
      return HttpResponse.json({ comanda: c, troco });
    },
  ),
  http.post(`${base}/admin/comandas/:id/retomar`, ({ params, request }) => {
    const denied = authorized(request, ["GARCOM", "GERENTE"]);
    if (denied) return denied;
    const bill = db.bills.find((b) => b.id === params.id);
    if (!bill) return problem(404);
    if (bill.status !== "AGUARDANDO_PAGAMENTO") return problem(409);
    const original = db.originalCharges[bill.id];
    if (original) {
      bill.taxaServicoPercentual = original.taxa;
      bill.couvert = original.couvert;
      delete db.originalCharges[bill.id];
      recalc(bill);
    }
    bill.status = "ABERTA";
    return HttpResponse.json(bill);
  }),
  http.post(
    `${base}/admin/comandas/:id/reabrir`,
    async ({ params, request }) => {
      const denied = authorized(request, ["GARCOM", "GERENTE"]);
      if (denied) return denied;
      const bill = db.bills.find((b) => b.id === params.id);
      if (!bill) return problem(404);
      const input = (await request.json()) as { motivo: string };
      if (
        bill.status !== "PAGA" ||
        input.motivo.trim().length < 3 ||
        db.bills.some(
          (b) =>
            b !== bill &&
            b.numeroMesa === bill.numeroMesa &&
            ["ABERTA", "AGUARDANDO_PAGAMENTO"].includes(b.status),
        )
      )
        return problem(409);
      bill.status = "ABERTA";
      return HttpResponse.json(bill);
    },
  ),
  http.get(`${base}/admin/dashboard/fechamento-diario`, ({ request }) =>
    HttpResponse.json({
      ...dashboard,
      dia: new URL(request.url).searchParams.get("dia") ?? dashboard.dia,
    }),
  ),
  http.get(
    `${base}/admin/configuracao/couvert`,
    ({ request }) =>
      authorized(request, ["GERENTE"]) ??
      HttpResponse.json({ valor: db.couvert }),
  ),
  http.put(`${base}/admin/configuracao/couvert`, async ({ request }) => {
    const denied = authorized(request, ["GERENTE"]);
    if (denied) return denied;
    const input = (await request.json()) as { valor: number };
    if (
      !Number.isFinite(input.valor) ||
      input.valor < 0 ||
      Math.round(input.valor * 100) !== input.valor * 100
    )
      return problem(422);
    db.couvert = input.valor;
    return HttpResponse.json({ valor: db.couvert });
  }),
  ...(
    ["produtos", "adicionais", "mesas", "usuarios", "dispositivos"] as const
  ).flatMap((kind) => {
    const collection = () =>
      ({
        produtos: db.products,
        adicionais: db.extras,
        mesas: db.tables,
        usuarios: db.users,
        dispositivos: db.devices,
      })[kind];
    return [
      http.get(`${base}/admin/${kind}`, ({ request }) => {
        const denied = authorized(
          request,
          kind === "mesas" || kind === "dispositivos"
            ? ["GARCOM", "GERENTE"]
            : ["GERENTE"],
        );
        if (denied) return denied;
        const url = new URL(request.url);
        let values: unknown[] = collection();
        if (kind === "produtos")
          values = db.products.filter(
            (p) =>
              (!url.searchParams.get("categoria") ||
                p.categoria === url.searchParams.get("categoria")) &&
              (!url.searchParams.get("busca") ||
                p.nome
                  .toLowerCase()
                  .includes(url.searchParams.get("busca")!.toLowerCase())) &&
              (!url.searchParams.has("ativo") ||
                p.ativo === (url.searchParams.get("ativo") === "true")),
          );
        return HttpResponse.json(
          kind === "produtos" || kind === "usuarios"
            ? page(values, request)
            : values,
        );
      }),
      http.post(`${base}/admin/${kind}`, async ({ request }) => {
        const input = (await request.json()) as Record<string, unknown>;
        const record: Record<string, unknown> = {
          ...input,
          id: crypto.randomUUID(),
          ...(kind === "produtos" ? { adicionaisDisponiveis: [] } : {}),
        };
        if (kind === "usuarios") delete record.senha;
        (collection() as unknown[]).push(record);
        return HttpResponse.json(record);
      }),
      http.patch(`${base}/admin/${kind}/:id`, async ({ params, request }) => {
        const record = collection().find((c) => c.id === params.id);
        if (!record) return problem(404);
        const input = (await request.json()) as Record<string, unknown>;
        if (kind === "usuarios") delete input.senha;
        Object.assign(record, input);
        if (kind === "dispositivos" && "mesaId" in input) {
          const table = db.tables.find((t) => t.id === input.mesaId);
          if (table) Object.assign(record, { numeroMesa: table.numero });
        }
        return HttpResponse.json(record);
      }),
      http.delete(`${base}/admin/${kind}/:id`, ({ params, request }) => {
        const denied = authorized(
          request,
          kind === "dispositivos" ? ["GARCOM", "GERENTE"] : ["GERENTE"],
        );
        if (denied) return denied;
        const record = collection().find((c) => c.id === params.id);
        if (!record) return problem(404);
        Object.assign(
          record,
          kind === "mesas" ? { ativa: false } : { ativo: false },
        );
        return new HttpResponse(null);
      }),
    ];
  }),
  http.patch(
    `${base}/admin/produtos/:id/disponibilidade`,
    async ({ params, request }) => {
      const p = db.products.find((p) => p.id === params.id);
      if (!p) return problem(404);
      Object.assign(p, await request.json());
      return new HttpResponse(null);
    },
  ),
  ...[`${base}/admin/kanban/eventos`, `${base}/mesa/pedidos/:id/eventos`].map(
    (path) =>
      http.get(path, ({ request }) => {
        const denied = authorized(request);
        if (denied) return denied;
        let current: ReadableStreamDefaultController<Uint8Array> | undefined;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            current = controller;
            streams.add(controller);
            controller.enqueue(
              new TextEncoder().encode(
                'event: conectado\ndata: {"ok":true}\n\n:heartbeat\n\n',
              ),
            );
            request.signal.addEventListener(
              "abort",
              () => {
                streams.delete(controller);
                try {
                  controller.close();
                } catch {
                  /* Já encerrado. */
                }
              },
              { once: true },
            );
          },
          cancel() {
            if (current) streams.delete(current);
          },
        });
        return new HttpResponse(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
  ),
];
export { ids };
