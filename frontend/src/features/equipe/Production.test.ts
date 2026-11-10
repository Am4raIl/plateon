import { optimisticMove } from "./Production";
import { makeOrder } from "../../test/mocks/fixtures";
import type { Kanban } from "../../api/types";
it("move o pedido inteiro e remove a origem", () => {
  const original: Kanban = {
    recebido: [
      {
        pedido: makeOrder(),
        numeroMesa: 7,
        minutosDecorridos: 28,
        atrasado: true,
      },
    ],
    emPreparo: [],
    pronto: [],
  };
  const moved = optimisticMove(
    original,
    original.recebido[0].pedido.id,
    "EM_PREPARO",
  );
  expect(moved.recebido).toHaveLength(0);
  expect(moved.emPreparo[0].pedido.status).toBe("EM_PREPARO");
  expect(moved.emPreparo[0].pedido.itens).toEqual(
    original.recebido[0].pedido.itens,
  );
  expect(original.recebido).toHaveLength(1);
});
it("entrega remove do quadro sem criar quarta coluna", () => {
  const p = { ...makeOrder(), status: "PRONTO" as const };
  const board: Kanban = {
    recebido: [],
    emPreparo: [],
    pronto: [
      { pedido: p, numeroMesa: 7, minutosDecorridos: 28, atrasado: false },
    ],
  };
  expect(optimisticMove(board, p.id, "ENTREGUE")).toEqual({
    recebido: [],
    emPreparo: [],
    pronto: [],
  });
});
it("mantém a ordem por envio e id ao mudar de coluna", () => {
  const makeCard = (id: string, enviadoEm: string) => ({
    pedido: { ...makeOrder(), id, enviadoEm },
    numeroMesa: 7,
    minutosDecorridos: 28,
    atrasado: false,
  });
  const board: Kanban = {
    recebido: [makeCard("b", "2026-11-07T10:00:00Z")],
    emPreparo: [
      makeCard("c", "2026-11-07T10:00:00Z"),
      makeCard("a", "2026-11-07T10:00:00Z"),
    ],
    pronto: [],
  };

  expect(
    optimisticMove(board, "b", "EM_PREPARO").emPreparo.map((c) => c.pedido.id),
  ).toEqual(["a", "b", "c"]);
});
