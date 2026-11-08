import { test, expect } from "@playwright/test";
test("saída do gerente permanece visível em telas baixas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/equipe/login");
  await page.getByLabel("Usuário", { exact: true }).fill("gerente");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair da conta" }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  const management = page.getByRole("navigation", { name: "Gerência" });
  await expect(
    management.getByRole("link", { name: "Mesas e adicionais" }),
  ).toBeVisible();
  await expect(management.getByRole("link", { name: "Equipe" })).toBeVisible();
  await expect(management.getByRole("link", { name: "Couvert" })).toBeVisible();
});
test("cadastros de usuários, adicionais e mesas salvam e desativam", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:8082/__test/reset");
  await page.goto("/equipe/login");
  await page.getByLabel("Usuário", { exact: true }).fill("gerente");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("link", { name: "Equipe", exact: true }).first().click();
  await page.getByRole("button", { name: "Criar funcionário" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Ana de teste");
  await page.getByLabel("Usuário", { exact: true }).fill("ana.teste");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("combobox", { name: /Papel/ }).selectOption("GARCOM");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  const user = page.getByRole("row").filter({ hasText: "Ana de teste" });
  await expect(user).toContainText("Garçom");
  await user.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("Nova senha (deixe vazia para manter)")
    .fill("nova-senha-teste");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  await user.getByRole("button", { name: "Desativar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Desativar funcionário" })
    .click();
  await expect(user).toContainText("Inativo");
  await page
    .getByRole("link", { name: "Mesas e adicionais", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Adicionais", exact: true }).click();
  await page.getByRole("button", { name: "Criar adicional" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Molho de teste");
  await page.getByLabel("Preço", { exact: true }).fill("5,00");
  await page.getByRole("checkbox", { name: "Massas", exact: true }).check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  const extra = page.getByRole("row").filter({ hasText: "Molho de teste" });
  await expect(extra).toContainText("Massas");
  await extra.getByRole("button", { name: "Desativar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Desativar adicional" })
    .click();
  await expect(extra).toContainText("Inativo");
  await page.getByRole("button", { name: "Mesas", exact: true }).click();
  await page.getByRole("button", { name: "Criar mesa" }).click();
  await page.getByLabel("Número da mesa").fill("13");
  await page.getByLabel("Lugares", { exact: true }).fill("6");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  const table = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: "Mesa 13", exact: true }),
  });
  await expect(table).toContainText("6");
  await table.getByRole("button", { name: "Desativar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Desativar mesa" })
    .click();
  await expect(table).toContainText("Inativo");
  await page.getByRole("link", { name: "Couvert", exact: true }).click();
  await page.getByLabel("Novo valor do couvert").fill("15,00");
  await page.getByRole("button", { name: "Salvar couvert" }).click();
  await expect(page.getByText("Valor atual: R$ 15,00")).toBeVisible();
});
