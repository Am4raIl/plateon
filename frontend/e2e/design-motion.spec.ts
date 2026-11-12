import { test, expect, type Page } from "@playwright/test";
import type { Cartao, Kanban } from "../src/api/types";
import { makeOrder } from "../src/test/mocks/fixtures";

async function openBoard(page: Page) {
  const card = (
    id: string,
    minute: number,
    status: "RECEBIDO" | "EM_PREPARO",
  ): Cartao => ({
    pedido: {
      ...makeOrder(),
      id,
      status,
      enviadoEm: `2026-11-07T10:${String(minute).padStart(2, "0")}:00Z`,
      numeroDiario: minute,
    },
    numeroMesa: minute,
    minutosDecorridos: 8,
    atrasado: false,
  });
  const board: Kanban = {
    recebido: [
      card("moving", 20, "RECEBIDO"),
      card("source-next", 30, "RECEBIDO"),
    ],
    emPreparo: [
      card("target-first", 10, "EM_PREPARO"),
      card("target-next", 40, "EM_PREPARO"),
    ],
    pronto: [],
  };
  await page.route(/\/api\/v1\/admin\/kanban(?:\?.*)?$/, (route) =>
    route.fulfill({ json: board }),
  );
  await page.route("**/api/v1/admin/kanban/moving/status", async (route) => {
    const moving = board.recebido.shift()!;
    moving.pedido = { ...moving.pedido, status: "EM_PREPARO", versao: 3 };
    board.emPreparo.splice(1, 0, moving);
    await route.fulfill({ json: moving.pedido });
  });
  await page.goto("/equipe/login");
  await page.getByLabel("Usuário", { exact: true }).fill("cozinha");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.locator('[data-pedido="moving"] button').last(),
  ).toBeEnabled();
  await page.locator("[data-drop-status]").evaluateAll(async (columns) => {
    await Promise.all(
      columns.flatMap((column) =>
        column
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  });
}

test("transferência encaixa na ordem correta e anima os cards das duas colunas", async ({
  page,
}) => {
  await openBoard(page);
  // Record actual browser animations as they are created, including animations
  // that finish while Playwright is waiting for the mutation to settle.
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    const records: string[] = [];
    Object.assign(window, { motionRecords: records });
    Element.prototype.animate = function (...args) {
      const frames = args[0];
      if (
        this instanceof HTMLElement &&
        this.dataset.pedido &&
        Array.isArray(frames) &&
        frames.some(
          (frame) =>
            typeof frame.transform === "string" &&
            frame.transform.startsWith("translate("),
        )
      ) {
        records.push(this.dataset.pedido);
      }
      return original.apply(this, args);
    };
  });
  await page
    .locator('[data-pedido="moving"]')
    .getByRole("button", { name: "Iniciar preparo" })
    .click();
  const target = page.locator('[data-drop-status="EM_PREPARO"] [data-pedido]');
  await expect(target).toHaveCount(3);
  expect(
    await target.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.pedido),
    ),
  ).toEqual(["target-first", "moving", "target-next"]);
  expect(
    await page.evaluate(
      () => (window as unknown as { motionRecords: string[] }).motionRecords,
    ),
  ).toEqual(expect.arrayContaining(["moving", "source-next", "target-next"]));
  await target.evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.flatMap((node) =>
        node
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  });
  const boxes = await target.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().toJSON()),
  );
  expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
  expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom);
  expect(boxes[1].left).toBe(boxes[0].left);
  await page.screenshot({
    path: "test-results/plateon-production-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Em preparo \(\d+\)$/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/plateon-production-mobile.png",
    fullPage: true,
  });
});

test("movimento reduzido preserva o encaixe sem animar a transferência", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBoard(page);
  await page
    .locator('[data-pedido="moving"]')
    .getByRole("button", { name: "Iniciar preparo" })
    .click();
  const moving = page.locator(
    '[data-drop-status="EM_PREPARO"] [data-pedido="moving"]',
  );
  await expect(moving).toBeVisible();
  expect(
    await moving.evaluate(
      (node) =>
        node
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect.getKeyframes().some((frame) => frame.transform),
          ).length,
    ),
  ).toBe(0);
});
