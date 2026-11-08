import type {
  AdicionalView,
  ChamadoAdminView,
  ComandaView,
  DispositivoView,
  FechamentoDiario,
  MesaView,
  PedidoView,
  ProdutoView,
  UsuarioView,
} from "../../api/types";
export const ids = {
  product: "11111111-1111-4111-8111-111111111111",
  extra: "22222222-2222-4222-8222-222222222222",
  order: "33333333-3333-4333-8333-333333333333",
  bill: "44444444-4444-4444-8444-444444444444",
  item: "55555555-5555-4555-8555-555555555555",
  table: "66666666-6666-4666-8666-666666666666",
  user: "77777777-7777-4777-8777-777777777777",
  device: "88888888-8888-4888-8888-888888888888",
  call: "99999999-9999-4999-8999-999999999999",
  pair: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
export const extra: AdicionalView = {
  id: ids.extra,
  nome: "Parmesão",
  preco: 7,
  ativo: true,
  categorias: ["MASSAS", "PIZZAS"],
};
export const product: ProdutoView = {
  id: ids.product,
  nome: "Tagliatelle ao ragu de pato",
  descricao: "Massa fresca, ragu de pato de cocção lenta, laranja e tomilho.",
  categoria: "MASSAS",
  preco: 76,
  imagemUrl: null,
  estacao: "COZINHA",
  tempoPreparoEstimadoMin: 20,
  disponivel: true,
  ativo: true,
  adicionaisDisponiveis: [extra],
};
export const tables: MesaView[] = [
  { id: ids.table, numero: 7, capacidade: 4, ativa: true },
  {
    id: "66666666-6666-4666-8666-666666666668",
    numero: 8,
    capacidade: 4,
    ativa: true,
  },
  {
    id: "66666666-6666-4666-8666-666666666663",
    numero: 3,
    capacidade: 4,
    ativa: true,
  },
];
export function makeOrder(): PedidoView {
  return {
    id: ids.order,
    comandaId: ids.bill,
    status: "RECEBIDO",
    numeroDiario: 14,
    diaOperacional: "2026-11-07",
    observacaoGeral: "Entregar tudo junto",
    criadoEm: new Date(Date.now() - 28 * 60000).toISOString(),
    enviadoEm: new Date(Date.now() - 28 * 60000).toISOString(),
    versao: 2,
    itens: [
      {
        id: ids.item,
        produtoId: ids.product,
        nomeProduto: product.nome,
        quantidade: 1,
        observacao: "Sem cebola",
        precoUnitario: 76,
        estacao: "COZINHA",
        adicionais: [],
        subtotal: 76,
      },
    ],
    subtotal: 76,
  };
}
export function makeBill(): ComandaView {
  return {
    id: ids.bill,
    status: "ABERTA",
    numeroMesa: 7,
    abertaEm: new Date().toISOString(),
    taxaServicoPercentual: 10,
    couvert: 12,
    pedidos: [makeOrder()],
    subtotal: 76,
    taxaServico: 7.6,
    total: 95.6,
  };
}
export const user: UsuarioView = {
  id: ids.user,
  nome: "Diego",
  username: "gerente",
  papel: "GERENTE",
  ativo: true,
};
export const device: DispositivoView = {
  id: ids.device,
  mesaId: ids.table,
  numeroMesa: 7,
  nome: "Tablet mesa 7",
  ativo: true,
  pareadoEm: "2026-11-02T21:24:00Z",
  ultimoAcessoEm: new Date().toISOString(),
  online: true,
};
export function makeCalls(): ChamadoAdminView[] {
  return [7, 12, 3].map((n, i) => ({
    id: i ? crypto.randomUUID() : ids.call,
    tipo: (["CONTA", "AJUDA", "GARCOM"] as const)[i],
    status: "ABERTO",
    criadoEm: new Date(Date.now() - [12, 8, 2][i] * 60000).toISOString(),
    atendidoEm: null,
    numeroMesa: n,
    comandaId: n === 7 ? ids.bill : null,
  }));
}
export const dashboard: FechamentoDiario = {
  dia: "2026-11-07",
  totalVendido: 8742,
  totalPedidos: 64,
  totalCancelados: 3,
  valorCancelado: 126,
  taxaServicoArrecadada: 802.4,
  ticketMedioPorComanda: 318.5,
  top10Itens: [{ nome: product.nome, quantidade: 32, receita: 2432 }],
  vendasPorCategoria: [{ categoria: "MASSAS", receita: 2432 }],
  vendasPorHora: [
    { hora: 12, receita: 1450 },
    { hora: 13, receita: 2200 },
    { hora: 14, receita: 1800 },
    { hora: 19, receita: 3292 },
  ],
  tempoMedioPreparoMin: 17.5,
  tempoMedioEntregaMin: 4.2,
  pedidosAtrasados: 2,
  vendasPorFormaPagamento: [
    { forma: "PIX", valor: 4000 },
    { forma: "DINHEIRO", valor: 1200 },
    { forma: "CARTAO_CREDITO", valor: 3542 },
  ],
};
