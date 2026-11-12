import { test, expect } from "@playwright/test";

for (const width of [320, 375, 390, 480, 600, 768, 1138, 1440]) {
  test(`tabelas e ações cabem em ${width}px`, async ({ page, request }) => {
    test.setTimeout(60000);
    await request.post("http://127.0.0.1:8082/__test/reset");
    await page.setViewportSize({ width, height: 800 });
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
    });
    for (const path of [
      "/equipe/comandas",
      "/equipe/tablets",
      "/gerencia/produtos",
      "/gerencia/usuarios",
      "/gerencia/adicionais-mesas",
      "/gerencia/dispositivos",
    ]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.locator("tbody tr").first()).toBeVisible();
        const table = page.locator("table").first();
        if (width <= 600) {
          expect(
            await table.evaluate(
              (node) => node.scrollWidth <= node.clientWidth + 1,
            ),
          ).toBeTruthy();
          const cells = table.locator("tbody td");
          for (const cell of await cells.all()) {
            await expect(cell).toHaveAttribute("data-label", /.+/);
            expect(
              await cell.evaluate((node) => {
                const box = node.getBoundingClientRect();
                return (
                  box.left >= 0 &&
                  box.right <= innerWidth &&
                  node.scrollWidth <= node.clientWidth + 1
                );
              }),
            ).toBeTruthy();
          }
        } else {
          expect(
            await table
              .locator("tbody tr")
              .first()
              .evaluate((node) => getComputedStyle(node).display),
          ).toBe("table-row");
          await expect(table.locator("thead")).toBeVisible();
        }
      });
    }
    await page.goto("/equipe/comandas");
    await page.getByRole("link", { name: "Ver conta" }).first().click();
    await expect(page).toHaveURL(/\/equipe\/comandas\/.+/);
    await page.goto("/equipe/tablets");
    await page
      .getByRole("button", { name: /Desparear tablet da/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `test-results/mobile-tables-${width}.png`,
      fullPage: true,
    });
  });
}
