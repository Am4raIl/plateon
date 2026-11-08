import { diaOperacional, moeda, resumoPagamentos, dataHora } from "./format";
it("formata reais em português", () =>
  expect(moeda(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56"));
it.each([
  ["2026-11-07T05:00:00Z", "2026-11-06"],
  ["2026-11-07T06:59:59Z", "2026-11-06"],
  ["2026-11-07T07:00:00Z", "2026-11-07"],
])("calcula dia operacional em %s", (date, expected) =>
  expect(diaOperacional(new Date(date))).toBe(expected),
);
it("converte instantes UTC para São Paulo", () =>
  expect(dataHora("2026-11-07T19:00:00Z")).toContain("16:00"));
it("confere pagamentos em centavos e troco sem recalcular a conta", () =>
  expect(
    resumoPagamentos(326.6, [
      { forma: "PIX", valor: 200 },
      { forma: "DINHEIRO", valor: 126.6, valorRecebido: 150 },
    ]),
  ).toEqual({ aplicado: 326.6, restante: 0, troco: 23.4 }));
it("não acumula erro binário na soma", () =>
  expect(
    resumoPagamentos(0.3, [
      { forma: "PIX", valor: 0.1 },
      { forma: "PIX", valor: 0.2 },
    ]).restante,
  ).toBe(0));
