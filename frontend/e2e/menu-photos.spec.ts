import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import photos from "../src/design/menu-photos.json" with { type: "json" };
import { product } from "../src/test/mocks/fixtures";
import { categorias } from "../src/api/types";
import { labels } from "../src/lib/format";

test("43 itens têm fotos locais válidas em todas as categorias e créditos acessíveis", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("plateon.tablet", "mock-tablet"),
  );
  await page.route("**/api/v1/mesa/cardapio", (route) =>
    route.fulfill({
      json: photos.map((photo, index) => ({
        ...product,
        id: `photo-${index}`,
        nome: photo.name,
        categoria: photo.category,
        imagemUrl:
          index % 2
            ? null
            : "/api/v1/imagens/produtos/11111111-1111-4111-8111-111111111111.svg",
      })),
    }),
  );
  await page.goto("/mesa/cardapio");
  const seen = new Set<string>();
  for (const category of categorias) {
    await page
      .getByRole("button", { name: new RegExp(labels[category]) })
      .click();
    const expected = photos.filter((photo) => photo.category === category);
    for (const photo of expected) {
      const image = page.getByRole("img", { name: photo.name, exact: true });
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute("src", new RegExp(`${photo.src}$`));
      expect(
        await image.evaluate(async (node) => {
          const image = node as HTMLImageElement;
          await image.decode();
          return image.naturalWidth > 0 && image.naturalHeight > 0;
        }),
      ).toBeTruthy();
      await expect(
        page.getByRole("link", {
          name: `Créditos da foto de ${photo.name}`,
          exact: true,
        }),
      ).toHaveAttribute("href", `/menu/credits.html#${photo.slug}`);
      seen.add(photo.name);
    }
  }
  expect(seen.size).toBe(43);
  await page.getByRole("button", { name: /Entradas/ }).click();
  await page.screenshot({
    path: "test-results/menu-real-photos-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["claro", "padrão", "escuro"]) {
    await page
      .getByRole("button", { name: `Modo ${theme}`, exact: true })
      .click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/menu-photos-${theme}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
  await page.goto("/menu/credits.html");
  await expect(page.locator("article")).toHaveCount(43);
});

test("fotografia cadastrada pelo restaurante tem prioridade sobre a referência local", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("plateon.tablet", "mock-tablet"),
  );
  await page.route("**/api/v1/mesa/cardapio", (route) =>
    route.fulfill({
      json: [
        {
          ...product,
          nome: "Bruschetta de Tomate",
          categoria: "ENTRADAS",
          imagemUrl: "/menu/custom-photo.webp",
        },
      ],
    }),
  );
  await page.route("**/menu/custom-photo.webp", async (route) => {
    const original = await page.request.get("/menu/bruschetta-de-tomate.webp");
    await route.fulfill({
      contentType: "image/webp",
      body: await original.body(),
    });
  });
  await page.goto("/mesa/cardapio");
  await expect(
    page.getByRole("img", { name: "Bruschetta de Tomate", exact: true }),
  ).toHaveAttribute("src", /\/menu\/custom-photo.webp$/);
  await expect(
    page.getByRole("link", { name: /Créditos da foto/ }),
  ).toHaveCount(0);
});
