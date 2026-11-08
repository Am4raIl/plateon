import {
  backwards,
  canCancel,
  canPay,
  canProduce,
  canSeeBills,
  canServe,
  nextStatus,
} from "./permissions";
it("bar é estação e cozinha não recebe ações de recebimento", () => {
  expect(canProduce("COZINHA")).toBe(true);
  expect(canPay("COZINHA")).toBe(false);
  expect(canSeeBills("COZINHA")).toBe(false);
  expect(canServe("COZINHA")).toBe(false);
});
it("garçom recebe pagamentos e move pedidos", () => {
  expect(canPay("GARCOM")).toBe(true);
  expect(canProduce("GARCOM")).toBe(true);
});
it.each([
  ["RECEBIDO", "EM_PREPARO"],
  ["EM_PREPARO", "PRONTO"],
  ["PRONTO", "ENTREGUE"],
  ["ENTREGUE", null],
  ["CANCELADO", null],
] as const)("avança %s uma única etapa", (current, next) =>
  expect(nextStatus(current)).toBe(next),
);
it("só gerente cancela recebido e ninguém cancela entregue", () => {
  expect(canCancel("GARCOM", "RECEBIDO")).toBe(false);
  expect(canCancel("GERENTE", "RECEBIDO")).toBe(true);
  expect(canCancel("GERENTE", "ENTREGUE")).toBe(false);
  expect(canCancel("COZINHA", "EM_PREPARO")).toBe(true);
});
it("bloqueia cancelamento e retrocesso com conta em fechamento", () => {
  expect(canCancel("GERENTE", "PRONTO", true)).toBe(false);
  expect(backwards("GERENTE", "PRONTO", true)).toEqual([]);
  expect(nextStatus("PRONTO")).toBe("ENTREGUE");
});
it("garçom e gerente podem retroceder comanda aberta", () => {
  expect(backwards("GARCOM", "PRONTO")).toEqual(["RECEBIDO", "EM_PREPARO"]);
  expect(backwards("GERENTE", "ENTREGUE")).toEqual([
    "RECEBIDO",
    "EM_PREPARO",
    "PRONTO",
  ]);
});
