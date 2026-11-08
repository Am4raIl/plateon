import type { Papel, StatusPedido } from "../api/types";
export const canProduce = (role: Papel) =>
  ["COZINHA", "GARCOM", "GERENTE"].includes(role);
export const canServe = (role: Papel) => ["GARCOM", "GERENTE"].includes(role);
export const canSeeBills = canServe;
export const canPay = canServe;
export const homeFor = (role: Papel) =>
  role === "GERENTE" ? "/gerencia/dashboard" : "/equipe/pedidos";
export function nextStatus(status: StatusPedido): StatusPedido | null {
  return (
    (
      {
        RECEBIDO: "EM_PREPARO",
        EM_PREPARO: "PRONTO",
        PRONTO: "ENTREGUE",
      } as Partial<Record<StatusPedido, StatusPedido>>
    )[status] ?? null
  );
}
export function canCancel(role: Papel, status: StatusPedido, locked = false) {
  return (
    !locked &&
    canProduce(role) &&
    (["EM_PREPARO", "PRONTO"].includes(status) ||
      (status === "RECEBIDO" && role === "GERENTE"))
  );
}
export function backwards(
  role: Papel,
  status: StatusPedido,
  locked = false,
): StatusPedido[] {
  const steps: StatusPedido[] = [
    "RECEBIDO",
    "EM_PREPARO",
    "PRONTO",
    "ENTREGUE",
  ];
  return canServe(role) && !locked
    ? steps.slice(0, Math.max(0, steps.indexOf(status)))
    : [];
}
