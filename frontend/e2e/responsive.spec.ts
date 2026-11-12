import { test, expect, type Page } from "@playwright/test";
import { ids } from "../src/test/mocks/fixtures";

test.use({ hasTouch: true });

const sizes = [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
  [960, 600],
  [600, 960],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1138, 712],
  [1180, 820],
  [1280, 600],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];

async function fits(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: innerWidth,
      })),
    )
    .toEqual({
      page: page.viewportSize()!.width,
      viewport: page.viewportSize()!.width,
    });
  const masthead = page.locator("header").filter({
    has: page.getByRole("navigation", { name: "Navegação da mesa" }),
  });
  const brand = masthead.locator(".brand");
  const table = masthead.getByText("Mesa 07", { exact: true });
  if ((await brand.count()) && (await table.count())) {
    const brandRight = await brand.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().right;
    });
    expect(brandRight).toBeLessThanOrEqual((await table.boundingBox())!.x);
  }
  // Wide tables may scroll inside their own wrapper; the page and board may not.
  const board = page.locator('[data-drop-status="RECEBIDO"]').locator("..");
  if (await board.count()) {
    expect(
      await board.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBeTruthy();
  }
}

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:8082/__test/reset");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "plateon.equipe",
      JSON.stringify({
        token: "mock-GERENTE",
        papel: "GERENTE",
        username: "gerente",
        expiraEm: new Date(Date.now() + 3600000).toISOString(),
      }),
    );
    localStorage.setItem("plateon.tablet", "mock-tablet");
  });
});

for (const [width, height] of sizes) {
  test(`layout e ações em ${width} × ${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    for (const path of [
      "/",
      "/equipe/login",
      "/gerencia/dashboard",
      "/equipe/pedidos",
      "/equipe/comandas",
      `/equipe/comandas/${ids.bill}`,
      `/equipe/comandas/${ids.bill}/fechar`,
      "/equipe/tablets",
      "/gerencia/produtos",
      "/gerencia/usuarios",
      "/gerencia/adicionais-mesas",
      "/gerencia/couvert",
      "/gerencia/dispositivos",
      "/mesa/boas-vindas",
      "/mesa/cardapio",
      `/mesa/produto/${ids.product}`,
      "/mesa/rascunho",
      "/mesa/comanda",
    ]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.locator("h1, h2").first()).toBeVisible();
        await fits(page);
      });
    }
    await page.goto("/gerencia/produtos");
    await page.getByRole("button", { name: "Criar produto" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Nome", { exact: true })).toBeVisible();
    await dialog
      .getByRole("button", { name: "Salvar alterações" })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Salvar alterações" }),
    ).toBeInViewport();
    await fits(page);
    await page.keyboard.press("Escape");
    await page.goto("/equipe/pedidos");
    await expect(
      page.getByRole("button", { name: "Iniciar preparo" }),
    ).toBeEnabled();
    const tabs = page.getByRole("group", { name: "Coluna do quadro" });
    if (width <= 1100) {
      await expect(tabs).toBeVisible();
      await tabs.getByRole("button", { name: /Em preparo/ }).click();
      await expect(
        page.locator('[data-drop-status="EM_PREPARO"]'),
      ).toBeVisible();
      await tabs.getByRole("button", { name: /Recebidos/ }).click();
    } else {
      await page
        .locator('[data-drop-status="RECEBIDO"]')
        .scrollIntoViewIfNeeded();
      for (const status of ["RECEBIDO", "EM_PREPARO", "PRONTO"]) {
        await expect(
          page.locator(`[data-drop-status="${status}"]`),
        ).toBeInViewport();
      }
    }
    await page.getByRole("button", { name: "Iniciar preparo" }).click();
    if (width <= 1100)
      await tabs.getByRole("button", { name: /Em preparo/ }).click();
    await expect(
      page.getByRole("button", { name: "Marcar pronto" }),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `test-results/responsive-production-${width}.png`,
      fullPage: true,
    });
    await page.goto("/mesa/cardapio");
    await page.getByRole("button", { name: "04 Massas" }).click();
    await page.getByRole("button", { name: "Escolher" }).click();
    await page.getByRole("button", { name: /Adicionar ao rascunho/ }).click();
    await page.getByRole("link", { name: "Cardápio", exact: true }).click();
    await page.getByRole("button", { name: "04 Massas" }).click();
    const review = page.getByRole("button", { name: "Revisar e enviar" });
    await expect(review).toBeInViewport();
    await fits(page);
    await page.screenshot({
      path: `test-results/responsive-menu-${width}.png`,
      fullPage: true,
    });
    await review.click();
    await expect(
      page.getByRole("button", { name: "Enviar pedido", exact: true }),
    ).toBeEnabled();
  });
}

test("tablet mantém pedidos e ações ao alternar entre paisagem e retrato", async ({
  page,
}) => {
  const { makeOrder } = await import("../src/test/mocks/fixtures");
  const lane = (status: "RECEBIDO" | "EM_PREPARO" | "PRONTO") =>
    Array.from({ length: 4 }, (_, i) => ({
      pedido: {
        ...makeOrder(),
        id: `${status}-${i}`,
        status,
        numeroDiario: i + 1,
        observacaoGeral: "Sem cebola. Servir os acompanhamentos separadamente.",
      },
      numeroMesa: i + 1,
      minutosDecorridos: 146,
      atrasado: true,
    }));
  await page.route(/\/api\/v1\/admin\/kanban(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        recebido: lane("RECEBIDO"),
        emPreparo: lane("EM_PREPARO"),
        pronto: lane("PRONTO"),
      },
    }),
  );
  await page.setViewportSize({ width: 1138, height: 712 });
  await page.goto("/equipe/pedidos");
  await expect(page.locator("[data-pedido]")).toHaveCount(12);
  for (const [width, height] of [
    [1138, 712],
    [712, 1138],
    [1138, 712],
  ]) {
    await page.setViewportSize({ width, height });
    await fits(page);
    const preparing = page.locator('[data-drop-status="EM_PREPARO"]');
    if (width <= 1100) {
      await page
        .getByRole("group", { name: "Coluna do quadro" })
        .getByRole("button", { name: "Em preparo (4)", exact: true })
        .click();
    }
    await expect(preparing.locator("[data-pedido]")).toHaveCount(4);
    const card = preparing.locator("[data-pedido]").first();
    await card.scrollIntoViewIfNeeded();
    if ((await card.locator("details").getAttribute("open")) === null) {
      await card.getByLabel("Ações do pedido 1", { exact: true }).click();
    }
    await card.getByRole("button", { name: "Ver pedido", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fits(page);
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `test-results/responsive-tablet-${width}.png`,
      fullPage: true,
    });
  }
});

test("arraste por toque e teclado continua disponível no quadro compacto do tablet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/equipe/pedidos");
  const handle = page.locator(
    `article[data-pedido="${ids.order}"]:not([aria-hidden="true"]) button[aria-roledescription]`,
  );
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  if (!source) throw Error("Alça ausente");
  const session = await page.context().newCDPSession(page);
  const point = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
    id: 1,
  };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  const destination = page.locator('[data-drop-status="EM_PREPARO"]');
  await expect(destination).toBeInViewport();
  const target = await destination.boundingBox();
  if (!target) throw Error("Destino ausente");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        id: 1,
      },
    ],
  });
  await expect(destination).toHaveAttribute("data-drop-over", "true");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page
    .getByRole("group", { name: "Coluna do quadro" })
    .getByRole("button", { name: /Em preparo/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Marcar pronto" }),
  ).toBeVisible();
  await handle.focus();
  await page.keyboard.press("Space");
  const ready = page.locator('[data-drop-status="PRONTO"]');
  await expect(ready).toBeInViewport();
  await page.keyboard.press("ArrowRight");
  await expect(ready).toHaveAttribute("data-drop-over", "true");
  await page.keyboard.press("Space");
  await page
    .getByRole("group", { name: "Coluna do quadro" })
    .getByRole("button", { name: /Prontos/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Entregar à mesa" }),
  ).toBeVisible();
});

test("pareamento cabe em celulares e tablets nas duas orientações", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.removeItem("plateon.tablet"));
  await page.goto("/mesa/pareamento");
  const code = page.getByLabel("Código de pareamento");
  await expect(code).toHaveText("ABC 234");
  for (const [width, height] of [
    [320, 568],
    [568, 320],
    [768, 1024],
    [1138, 712],
  ]) {
    await page.setViewportSize({ width, height });
    await fits(page);
    expect(
      await code.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBeTruthy();
  }
});

test("cabeçalho da mesa se ajusta nos limites dos breakpoints", async ({
  page,
}) => {
  await page.goto("/mesa/cardapio");
  await expect(
    page.getByRole("navigation", { name: "Navegação da mesa" }),
  ).toBeVisible();
  for (const width of [
    280, 650, 680, 700, 701, 900, 901, 1100, 1101, 1200, 1201, 1280, 1281,
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await fits(page);
  }
});
