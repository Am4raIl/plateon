import { z } from "zod";
export const categorias = [
  "ENTRADAS",
  "PORCOES",
  "HAMBURGUERES",
  "MASSAS",
  "PIZZAS",
  "PRATOS_PRINCIPAIS",
  "BEBIDAS",
  "SOBREMESAS",
] as const;
export type Categoria = (typeof categorias)[number];
export const papeis = ["COZINHA", "GARCOM", "GERENTE"] as const;
export type Papel = (typeof papeis)[number];
export const statusPedido = [
  "RASCUNHO",
  "RECEBIDO",
  "EM_PREPARO",
  "PRONTO",
  "ENTREGUE",
  "CANCELADO",
] as const;
export type StatusPedido = (typeof statusPedido)[number];
export type StatusComanda =
  "ABERTA" | "AGUARDANDO_PAGAMENTO" | "PAGA" | "CANCELADA";
export type Estacao = "COZINHA" | "BAR";
export interface AdicionalView {
  id: string;
  nome: string;
  preco: number;
  ativo: boolean;
  categorias: Categoria[];
}
export interface ProdutoView {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: Categoria;
  preco: number;
  imagemUrl: string | null;
  estacao: Estacao;
  tempoPreparoEstimadoMin: number;
  disponivel: boolean;
  ativo: boolean;
  adicionaisDisponiveis: AdicionalView[];
}
export interface ItemPedido {
  id: string;
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  observacao: string | null;
  precoUnitario: number;
  estacao: Estacao;
  adicionais: { id: string; nome: string; preco: number }[];
  subtotal: number;
}
export interface PedidoView {
  id: string;
  comandaId: string;
  status: StatusPedido;
  numeroDiario: number | null;
  diaOperacional: string | null;
  observacaoGeral: string | null;
  criadoEm: string;
  enviadoEm: string | null;
  versao: number;
  itens: ItemPedido[];
  subtotal: number;
}
export interface ComandaView {
  id: string;
  status: StatusComanda;
  numeroMesa: number;
  abertaEm: string;
  taxaServicoPercentual: number;
  couvert: number;
  pedidos: PedidoView[];
  subtotal: number;
  taxaServico: number;
  total: number;
}
export type ComandaResumo = Omit<
  ComandaView,
  "pedidos" | "couvert" | "taxaServicoPercentual"
> & { atualizadaEm: string };
export interface EstadoMesa {
  estado: "LIVRE" | "EM_ATENDIMENTO" | "AGUARDANDO_PAGAMENTO";
  numeroMesa: number;
}
export interface MesaView {
  id: string;
  numero: number;
  capacidade: number;
  ativa: boolean;
}
export interface UsuarioView {
  id: string;
  nome: string;
  username: string;
  papel: Papel;
  ativo: boolean;
}
export interface DispositivoView {
  id: string;
  mesaId: string;
  numeroMesa: number;
  nome: string;
  ativo: boolean;
  pareadoEm: string;
  ultimoAcessoEm: string | null;
  online: boolean;
}
export interface ChamadoView {
  id: string;
  tipo: "GARCOM" | "CONTA" | "AJUDA";
  status: "ABERTO" | "ATENDIDO";
  criadoEm: string;
}
export interface ChamadoAdminView extends ChamadoView {
  atendidoEm: string | null;
  numeroMesa: number;
  comandaId: string | null;
}
export interface Cartao {
  pedido: PedidoView;
  numeroMesa: number;
  minutosDecorridos: number;
  atrasado: boolean;
}
export interface Kanban {
  recebido: Cartao[];
  emPreparo: Cartao[];
  pronto: Cartao[];
}
export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  totalItens: number;
  totalPaginas: number;
  temProxima: boolean;
}
export const loginSchema = z.object({
  token: z.string().min(1),
  expiraEm: z.string().datetime(),
  papel: z.enum(papeis),
});
export type LoginView = z.infer<typeof loginSchema>;
export const solicitacaoSchema = z.object({
  solicitacaoId: z.string().uuid(),
  codigo: z.string().min(1),
  expiraEm: z.string().datetime(),
});
export type SolicitacaoPareamento = z.infer<typeof solicitacaoSchema>;
export const estadoPareamentoSchema = z.object({
  status: z.enum(["PENDENTE", "APROVADA", "CONSUMIDA"]),
  token: z.string().nullable(),
});
export const formas = [
  "DINHEIRO",
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
] as const;
export type FormaPagamento = (typeof formas)[number];
export interface Pagamento {
  forma: FormaPagamento;
  valor: number;
  valorRecebido?: number;
}
export interface FechamentoView {
  comanda: ComandaView;
  troco: number;
}
export interface FechamentoDiario {
  dia: string;
  totalVendido: number;
  totalPedidos: number;
  totalCancelados: number;
  valorCancelado: number;
  taxaServicoArrecadada: number;
  ticketMedioPorComanda: number;
  top10Itens: { nome: string; quantidade: number; receita: number }[];
  vendasPorCategoria: { categoria: Categoria; receita: number }[];
  vendasPorHora: { hora: number; receita: number }[];
  tempoMedioPreparoMin: number | null;
  tempoMedioEntregaMin: number | null;
  pedidosAtrasados: number;
  vendasPorFormaPagamento: { forma: FormaPagamento; valor: number }[];
}
export interface ItemInput {
  produtoId: string;
  quantidade: number;
  observacao: string;
  adicionaisIds: string[];
}
const moneySchema = z.number().finite().nonnegative();
const itemViewSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  nomeProduto: z.string(),
  quantidade: z.number().int().positive(),
  observacao: z.string().nullable(),
  precoUnitario: moneySchema,
  estacao: z.enum(["COZINHA", "BAR"]),
  adicionais: z.array(
    z.object({ id: z.string(), nome: z.string(), preco: moneySchema }),
  ),
  subtotal: moneySchema,
});
export const pedidoSchema = z.object({
  id: z.string(),
  comandaId: z.string(),
  status: z.enum(statusPedido),
  numeroDiario: z.number().int().nullable(),
  diaOperacional: z.string().nullable(),
  observacaoGeral: z.string().nullable(),
  criadoEm: z.string(),
  enviadoEm: z.string().nullable(),
  versao: z.number().int().nonnegative(),
  itens: z.array(itemViewSchema),
  subtotal: moneySchema,
});
export const comandaSchema = z.object({
  id: z.string(),
  status: z.enum(["ABERTA", "AGUARDANDO_PAGAMENTO", "PAGA", "CANCELADA"]),
  numeroMesa: z.number().int().positive(),
  abertaEm: z.string(),
  taxaServicoPercentual: moneySchema,
  couvert: moneySchema,
  pedidos: z.array(pedidoSchema),
  subtotal: moneySchema,
  taxaServico: moneySchema,
  total: moneySchema,
});
export const fechamentoSchema = z.object({
  comanda: comandaSchema,
  troco: moneySchema,
});
export const kanbanSchema = z.object({
  recebido: z.array(
    z.object({
      pedido: pedidoSchema,
      numeroMesa: z.number().int(),
      minutosDecorridos: z.number(),
      atrasado: z.boolean(),
    }),
  ),
  emPreparo: z.array(
    z.object({
      pedido: pedidoSchema,
      numeroMesa: z.number().int(),
      minutosDecorridos: z.number(),
      atrasado: z.boolean(),
    }),
  ),
  pronto: z.array(
    z.object({
      pedido: pedidoSchema,
      numeroMesa: z.number().int(),
      minutosDecorridos: z.number(),
      atrasado: z.boolean(),
    }),
  ),
});
