import type { Pagamento } from "../api/types";
export const moeda = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export const numero = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
export const mesa = (n: number) => `Mesa ${String(n).padStart(2, "0")}`;
export const dataHora = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(s))
    : "Ainda sem acesso";
export const minutos = (s: string) =>
  Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 60000));
export const relativo = (s: string | null) =>
  s
    ? `há ${minutos(s) < 1 ? `${Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 1000))} s` : `${minutos(s)} min`}`
    : "Ainda sem acesso";
export function diaOperacional(date = new Date()) {
  const local = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  if (local.getHours() < 4) local.setDate(local.getDate() - 1);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
export const centavos = (n: number) => Math.round(n * 100);
export function resumoPagamentos(total: number, pagamentos: Pagamento[]) {
  const aplicado = pagamentos.reduce((s, p) => s + centavos(p.valor), 0);
  return {
    aplicado: aplicado / 100,
    restante: (centavos(total) - aplicado) / 100,
    troco:
      pagamentos.reduce(
        (s, p) =>
          s +
          (p.forma === "DINHEIRO"
            ? centavos(p.valorRecebido ?? p.valor) - centavos(p.valor)
            : 0),
        0,
      ) / 100,
  };
}
export const labels: Record<string, string> = {
  ENTRADAS: "Entradas",
  PORCOES: "Porções",
  HAMBURGUERES: "Hambúrgueres",
  MASSAS: "Massas",
  PIZZAS: "Pizzas",
  PRATOS_PRINCIPAIS: "Pratos principais",
  BEBIDAS: "Bebidas",
  SOBREMESAS: "Sobremesas",
  COZINHA: "Cozinha",
  BAR: "Bar",
  GARCOM: "Garçom",
  GERENTE: "Gerente",
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
  CONTA: "Conta",
  AJUDA: "Ajuda",
  ABERTO: "Aberto",
  ATENDIDO: "Atendido",
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Crédito",
  CARTAO_DEBITO: "Débito",
  ATIVAS: "Ativas",
};
