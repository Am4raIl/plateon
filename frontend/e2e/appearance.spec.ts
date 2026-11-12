import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("aparência persiste ao recarregar e acompanha a navegação", async ({
  page,
}) => {
  await page.goto("/equipe/login");
  const appearance = page.getByRole("group", {
    name: "Aparência",
    exact: true,
  });
  await expect(
    appearance.getByRole("button", { name: "Modo padrão" }),
  ).toHaveAttribute("aria-pressed", "true");
  const original = await page
    .locator("body")
    .evaluate((body) => getComputedStyle(body).backgroundColor);
  await appearance.getByRole("button", { name: "Modo claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(
    appearance.getByRole("button", { name: "Modo claro" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Usuário", { exact: true }).fill("cozinha");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Modo escuro", exact: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Modo padrão", exact: true })
    .first()
    .click();
  await expect
    .poll(() =>
      page
        .locator("body")
        .evaluate((body) => getComputedStyle(body).backgroundColor),
    )
    .toBe(original);
});

test("três aparências acessíveis em login, produção e cardápio no celular", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["claro", "padrão", "escuro"]) {
    await page.goto("/equipe/login");
    await page
      .getByRole("button", { name: `Modo ${theme}`, exact: true })
      .click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await page.getByLabel("Usuário", { exact: true }).fill("cozinha");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["claro", "padrão", "escuro"]) {
    await page
      .getByRole("group", { name: "Aparência" })
      .filter({ visible: true })
      .getByRole("button", { name: `Modo ${theme}`, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/production-${theme}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
  await page.addInitScript(() =>
    localStorage.setItem("plateon.tablet", "mock-tablet"),
  );
  await page.goto("/mesa/cardapio");
  for (const theme of ["claro", "padrão", "escuro"]) {
    await page
      .getByRole("button", { name: `Modo ${theme}`, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/menu-${theme}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
});
