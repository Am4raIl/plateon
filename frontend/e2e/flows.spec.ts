import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ids } from "../src/test/mocks/fixtures";
const API = "http://127.0.0.1:8082";
const staffHeaders = { Authorization: "Bearer mock-GERENTE" };
async function login(page: Page, username = "gerente") {
  await page.goto("/equipe/login");
  await page.getByLabel("Usuário", { exact: true }).fill(username);
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}
async function tablet(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("panteon.tablet", "mock-tablet"),
  );
  await page.goto("/mesa/boas-vindas");
  await expect(
    page.getByRole("heading", { name: "Mesa 07", exact: true }),
  ).toBeVisible();
}
async function deliver(request: APIRequestContext) {
  for (const [i, novoStatus] of [
    "EM_PREPARO",
    "PRONTO",
    "ENTREGUE",
  ].entries()) {
    const r = await request.patch(
      `${API}/api/v1/admin/kanban/${ids.order}/status`,
      {
        headers: staffHeaders,
        data: { novoStatus, versao: 2 + i, motivo: null },
      },
    );
    expect(r.ok()).toBeTruthy();
  }
}
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test("pareamento entre tablet e gerente, sem expor token", async ({
  page,
  context,
}) => {
  await page.goto("/mesa/pareamento");
  await expect(page.getByLabel("Código de pareamento")).toHaveText("ABC 234");
  const staff = await context.newPage();
  await login(staff);
  await staff
    .getByRole("link", { name: "Tablets", exact: true })
    .first()
    .click();
  await staff.getByLabel("Código mostrado no tablet").fill("ABC 234");
  await staff.getByLabel("Mesa", { exact: true }).selectOption(ids.table);
  await staff.getByRole("button", { name: "Aprovar pareamento" }).click();
  await expect(page).toHaveURL(/boas-vindas/);
  await expect(page.locator("body")).not.toContainText("mock-tablet");
  await staff.close();
});
test("garçom despareia e pareia uma mesa sem apoio da gerência", async ({
  page,
  context,
}) => {
  await page.goto("/mesa/pareamento");
  await expect(page.getByLabel("Código de pareamento")).toHaveText("ABC 234");
  const staff = await context.newPage();
  await login(staff, "garcom");
  await staff.getByRole("link", { name: "Tablets", exact: true }).click();
  await staff
    .getByRole("button", { name: "Desparear tablet da Mesa 07" })
    .click();
  await staff
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar despareamento" })
    .click();
  await expect(staff.getByText("Tablet da Mesa 07 despareado.")).toBeVisible();
  await staff.getByLabel("Código mostrado no tablet").fill("ABC 234");
  await staff.getByLabel("Mesa", { exact: true }).selectOption(ids.table);
  await staff.getByRole("button", { name: "Aprovar pareamento" }).click();
  await expect(page).toHaveURL(/boas-vindas/);
  await staff.close();
});
test("busca no cardápio encontra produtos de outra categoria", async ({
  page,
}) => {
  await tablet(page);
  await page.goto("/mesa/cardapio");
  await expect(page.getByRole("heading", { name: "Entradas" })).toBeVisible();
  await page.getByLabel("Buscar no cardápio").fill("Tagliatelle");
  await expect(
    page.getByRole("heading", { name: "Resultados da busca" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tagliatelle ao ragu de pato" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.getByRole("heading", { name: "Entradas" })).toBeVisible();
});
test("saída após o pagamento libera o tablet para pareamento", async ({
  page,
}) => {
  await tablet(page);
  await page.goto("/mesa/encerramento");
  await page.getByRole("button", { name: "Voltar ao pareamento" }).click();
  await expect(page).toHaveURL(/mesa\/pareamento/);
  await expect(page.getByLabel("Código de pareamento")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("panteon.tablet")),
  ).toBeNull();
});
test("pedido completo do cardápio até entrega e atualização no tablet", async ({
  page,
  context,
}) => {
  await tablet(page);
  await page.getByRole("link", { name: "Ver o cardápio" }).click();
  await page.getByRole("button", { name: "04 Massas" }).click();
  await page.getByRole("button", { name: "Escolher" }).click();
  await page.getByRole("checkbox", { name: /Parmesão/ }).check();
  await page.getByRole("button", { name: /Adicionar ao rascunho/ }).click();
  await expect(
    page.getByRole("heading", { name: "Seu rascunho" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enviar pedido", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pedido Nº 17 enviado" }),
  ).toBeVisible();
  const staff = await context.newPage();
  await login(staff, "cozinha");
  const card = staff
    .locator("article")
    .filter({ has: staff.getByText("Nº 17", { exact: true }) });
  await card.getByRole("button", { name: "Iniciar preparo" }).click();
  await card.getByRole("button", { name: "Marcar pronto" }).click();
  await card.getByRole("button", { name: "Entregar à mesa" }).click();
  await expect(
    page.getByLabel("Andamento do pedido").getByText("✓ Entregue"),
  ).toBeVisible();
  await staff.close();
});
test("garçom retrocede pedido movido por engano", async ({ page }) => {
  await login(page, "garcom");
  await page.getByRole("button", { name: "Iniciar preparo" }).click();
  await page.getByLabel("Ações do pedido 14").click();
  await page.getByRole("button", { name: "Voltar a Recebido" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Motivo obrigatório")
    .fill("Movido por engano");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retroceder pedido" })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeVisible();
});
test("garçom abre comanda escolhendo a mesa pelo número", async ({ page }) => {
  await login(page, "garcom");
  await page
    .getByRole("link", { name: "Comandas", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Abrir comanda" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Mesa", { exact: true })
    .selectOption(ids.table);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Abrir comanda" })
    .click();
  await expect(page).toHaveURL(/equipe\/comandas\//);
});
test("chamar garçom e atender chamado", async ({ page, context }) => {
  await tablet(page);
  await page
    .getByRole("button", { name: "Chamar garçom", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Chamar garçom" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Já estamos a caminho" }),
  ).toBeVisible();
  const staff = await context.newPage();
  await login(staff, "garcom");
  await staff
    .getByRole("link", { name: "Pedidos e chamados", exact: true })
    .first()
    .click();
  const card = staff
    .locator("article")
    .filter({ has: staff.getByText("● Garçom", { exact: true }) })
    .filter({ has: staff.getByRole("heading", { name: "07", exact: true }) });
  await card.getByRole("button", { name: "Marcar atendido" }).click();
  await expect(
    staff.getByText("Mesa 07 marcada como atendida.").first(),
  ).toBeVisible();
  await staff.close();
});
test("fechamento com dinheiro e troco libera a mesa", async ({
  page,
  request,
}) => {
  await deliver(request);
  await login(page, "garcom");
  await page.getByRole("link", { name: "Ver conta" }).click();
  await page.getByRole("link", { name: "Fechar conta", exact: true }).click();
  await page
    .getByRole("button", { name: "Iniciar fechamento sem pagamento" })
    .click();
  await expect(page.getByText("● Aguardando pagamento")).toBeVisible();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  await page.getByLabel("Valor recebido em dinheiro").fill("100,00");
  await page.getByRole("button", { name: "+ Adicionar", exact: true }).click();
  await expect(page.getByText("R$ 4,40").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar recebimento e fechar" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Conta fechada. Mesa 07 livre." }),
  ).toBeVisible();
});
test("comanda aguardando volta a aberta e restaura os encargos", async ({
  page,
  request,
}) => {
  await deliver(request);
  await login(page, "garcom");
  await page.getByRole("link", { name: "Ver conta" }).click();
  await page.getByRole("link", { name: "Fechar conta", exact: true }).click();
  await page.getByRole("switch", { name: "Remover taxa de serviço" }).click();
  await page.getByRole("switch", { name: "Remover couvert" }).click();
  await page
    .getByRole("button", { name: "Atualizar total e iniciar fechamento" })
    .click();
  await expect(page.getByText("R$ 76,00").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar para comanda aberta" })
    .click();
  await expect(page.getByText("R$ 95,60").first()).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Remover couvert" }),
  ).not.toBeChecked();
});
test("chamado de conta abre o fechamento e permite reabrir com motivo", async ({
  page,
  request,
}) => {
  await deliver(request);
  await login(page, "garcom");
  await page
    .getByRole("link", { name: "Pedidos e chamados", exact: true })
    .first()
    .click();
  const call = page
    .locator("article")
    .filter({ hasText: "A mesa pediu a conta" });
  await call.getByRole("link", { name: "Fechar conta da mesa" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/equipe/comandas/${ids.bill}/fechar`),
  );
  await page.getByLabel("Valor aplicado à conta").fill("95,60");
  await expect(page.getByLabel("Valor aplicado à conta")).toHaveValue(
    "R$ 95,60",
  );
  await page.getByRole("button", { name: "+ Adicionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar recebimento e fechar" })
    .click();
  await page.goto(`/equipe/comandas/${ids.bill}/fechar`);
  await page
    .getByLabel("Motivo da reabertura")
    .fill("Pagamento registrado por engano");
  await page.getByRole("button", { name: "Reabrir comanda" }).click();
  await expect(
    page.getByRole("heading", { name: /Fechar a conta/ }),
  ).toBeVisible();
});
test("pagamento pelo garçom devolve o tablet ao pareamento", async ({
  page,
  context,
  request,
}) => {
  await tablet(page);
  await deliver(request);
  const staff = await context.newPage();
  await login(staff, "garcom");
  await staff
    .getByRole("link", { name: "Comandas", exact: true })
    .first()
    .click();
  await staff.getByRole("link", { name: "Ver conta" }).click();
  await staff.getByRole("link", { name: "Fechar conta", exact: true }).click();
  await staff.getByLabel("Valor aplicado à conta").fill("95,60");
  await staff.getByRole("button", { name: "+ Adicionar", exact: true }).click();
  await staff
    .getByRole("button", { name: "Confirmar recebimento e fechar" })
    .click();
  await expect(page).toHaveURL(/mesa\/pareamento/, { timeout: 8000 });
  await expect(page.getByLabel("Código de pareamento")).toBeVisible();
  await staff.close();
});
test("garçom não pode forçar fechamento pendente e gerente confirma a consequência", async ({
  page,
}) => {
  await login(page, "garcom");
  await page.getByRole("link", { name: "Ver conta" }).click();
  await page.getByRole("link", { name: "Fechar conta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar recebimento e fechar" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Fechamento forçado", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await login(page);
  await page.goto(`/equipe/comandas/${ids.bill}/fechar`);
  await page.getByLabel(/Fechar ignorando/).check();
  await page.getByLabel("Valor aplicado à conta").fill("95,60");
  await page.getByRole("button", { name: "+ Adicionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Forçar fechamento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "rascunhos serão cancelados",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Forçar fechamento" })
    .click();
  await expect(page).toHaveURL(/\/equipe\/comandas$/);
});
test("conflito restaura cartão e exige a versão atual", async ({
  page,
  request,
}) => {
  await login(page, "cozinha");
  await request.post(`${API}/__test/fail`, {
    data: {
      path: `/api/v1/admin/kanban/${ids.order}/status`,
      status: 409,
      times: 1,
    },
  });
  await page.getByRole("button", { name: "Iniciar preparo" }).click();
  await expect(page.locator('[role="alert"][class*="toast"]')).toContainText(
    "Este pedido foi alterado por outra pessoa.",
  );
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Iniciar preparo" }).click();
  await expect(
    page.getByRole("button", { name: "Marcar pronto" }),
  ).toBeVisible();
});
test("sessão expirada volta ao login e preserva destino", async ({
  page,
  request,
}) => {
  await login(page, "cozinha");
  await request.post(`${API}/__test/fail`, {
    data: {
      path: `/api/v1/admin/kanban/${ids.order}/status`,
      status: 401,
      times: 1,
    },
  });
  await page.getByRole("button", { name: "Iniciar preparo" }).click();
  await expect(page).toHaveURL(/equipe\/login/);
  await expect(
    page.getByRole("status").filter({ hasText: "Sua sessão expirou" }),
  ).toBeVisible();
  await page.getByLabel("Usuário", { exact: true }).fill("cozinha");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/equipe\/pedidos/);
});
test("revogação devolve tablet ao pareamento", async ({ page, context }) => {
  await tablet(page);
  const staff = await context.newPage();
  await login(staff);
  await staff
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first()
    .click();
  await staff.getByRole("button", { name: "Revogar", exact: true }).click();
  await staff
    .getByRole("dialog")
    .getByRole("button", { name: "Revogar tablet" })
    .click();
  await expect(page).toHaveURL(/mesa\/pareamento/, { timeout: 15000 });
  await staff.close();
});
test("produtos: criar, editar, disponibilidade e desativar", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Produtos", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Criar produto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Prato de teste");
  await page.getByLabel("Preço", { exact: true }).fill("29,90");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: "Prato de teste", exact: true }),
  });
  await expect(row).toBeVisible();
  await row.getByRole("switch").click();
  await expect(row.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Prato revisado");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  const revised = page.getByRole("row").filter({ hasText: "Prato revisado" });
  await revised.getByRole("button", { name: "Desativar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Desativar produto" })
    .click();
  await expect(revised).toContainText("Inativo");
});
test("papéis escondem menus e bloqueiam acesso direto", async ({ page }) => {
  await login(page, "cozinha");
  await expect(
    page.getByRole("link", { name: "Comandas", exact: true }),
  ).toHaveCount(0);
  await page.goto("/gerencia/usuarios");
  await expect(
    page.getByRole("heading", { name: "Acesso negado", exact: true }),
  ).toBeVisible();
});
test("acessibilidade das telas principais", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/equipe/login");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await login(page);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page
    .getByRole("link", { name: /Pedidos/ })
    .first()
    .click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("telas responsivas sem rolagem horizontal da página", async ({ page }) => {
  await login(page, "garcom");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "Pedidos e chamados", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: /Chamados das mesas/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/chamados-mobile.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("Kanban por teclado: mover, ver detalhes, entregar e cancelar arraste", async ({
  page,
}) => {
  await login(page, "cozinha");
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeEnabled();
  const handle = () => page.getByRole("button", { name: /Arrastar pedido 14/ });
  await handle().focus();
  await page.keyboard.press("Space", { delay: 40 });
  await page.keyboard.press("Escape");
  await expect(handle()).not.toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeVisible();
  await handle().focus();
  await page.keyboard.press("Space", { delay: 40 });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-drop-status="EM_PREPARO"]')).toHaveAttribute(
    "data-drop-over",
    "true",
  );
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Marcar pronto" }),
  ).toBeVisible();
  await handle().focus();
  await page.keyboard.press("m");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Marcar pronto" }).click();
  await expect(
    page.getByRole("button", { name: "Entregar à mesa" }),
  ).toBeEnabled();
  await handle().focus();
  await page.keyboard.press("Space", { delay: 40 });
  await expect(
    page.getByText("✓ Solte aqui para entregar à mesa"),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-drop-status="ENTREGUE"]')).toHaveAttribute(
    "data-drop-over",
    "true",
  );
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Entregar à mesa" }),
  ).toHaveCount(0);
});

test("Kanban por mouse move um passo e rejeita pular etapas", async ({
  page,
}) => {
  await login(page, "cozinha");
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeEnabled();
  const dragTo = async (status: string) => {
    const handle = await page
      .getByRole("button", { name: /Arrastar pedido 14/ })
      .boundingBox();
    const target = await page
      .locator(`[data-drop-status="${status}"]`)
      .boundingBox();
    if (!handle || !target) throw Error("Área de arraste ausente");
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + 8,
      handle.y + handle.height / 2,
      { steps: 2 },
    );
    await page.mouse.move(target.x + target.width / 2, target.y + 100, {
      steps: 15,
    });
    await expect(
      page.locator(`[data-drop-status="${status}"]`),
    ).toHaveAttribute("data-drop-over", "true");
    const source = await page
      .locator(`[data-pedido="${ids.order}"]`)
      .first()
      .boundingBox();
    const previewWidth = await page
      .locator('article[aria-hidden="true"]')
      .evaluate((node) => (node as HTMLElement).offsetWidth);
    if (!source) throw Error("Card de origem ausente");
    expect(Math.abs(source.width - previewWidth)).toBeLessThanOrEqual(2);
    await expect
      .poll(() =>
        page
          .locator('article[aria-hidden="true"]')
          .evaluate((node) =>
            Number(
              (node as HTMLElement).style
                .getPropertyValue("--tilt")
                .replace("deg", ""),
            ),
          ),
      )
      .toBeGreaterThan(0);
    await page.mouse.up();
  };
  await dragTo("PRONTO");
  await expect(
    page.getByRole("button", { name: "Iniciar preparo" }),
  ).toBeVisible();
  await dragTo("EM_PREPARO");
  await expect(
    page.getByRole("button", { name: "Marcar pronto" }),
  ).toBeVisible();
});

test("limite de tentativas aguarda e repete somente após a espera", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/fail`, {
    data: { path: "/api/v1/auth/login", status: 429, times: 1 },
  });
  await page.goto("/equipe/login");
  await page.getByLabel("Usuário", { exact: true }).fill("gerente");
  await page.getByLabel("Senha", { exact: true }).fill("dev12345678");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Entrar.*aguarde/ }),
  ).toBeDisabled();
  await expect(page).toHaveURL(/gerencia\/dashboard/);
});

test("falha de envio preserva o mesmo rascunho para tentar novamente", async ({
  page,
  request,
}) => {
  await tablet(page);
  await page.getByRole("link", { name: "Ver o cardápio" }).click();
  await page.getByRole("button", { name: "04 Massas" }).click();
  await page.getByRole("button", { name: "Escolher" }).click();
  await page.getByRole("button", { name: /Adicionar ao rascunho/ }).click();
  await expect(
    page.getByRole("heading", { name: "Seu rascunho" }),
  ).toBeVisible();
  await request.post(`${API}/__test/fail`, {
    data: { path: "/api/v1/mesa/pedidos/", status: 500, times: 1 },
  });
  await page
    .getByRole("button", { name: "Enviar pedido", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tentar enviar novamente" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar enviar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Pedido Nº 17 enviado" }),
  ).toBeVisible();
});

test("tablet acessível em 1280 × 800 e catálogo de gerência navegável", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await tablet(page);
  await page.getByRole("link", { name: "Ver o cardápio" }).click();
  await page.getByRole("button", { name: "04 Massas" }).click();
  await expect(
    page.getByRole("heading", { name: "Tagliatelle ao ragu de pato" }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/cardapio-tablet.png",
    fullPage: true,
  });
  await page.goto("/equipe/login");
  await login(page);
  for (const [name, heading] of [
    ["Usuários", "Usuários"],
    ["Adicionais e mesas", "Adicionais e mesas"],
    ["Dispositivos", "Cada tablet em sua mesa"],
  ]) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true, level: 1 }),
    ).toBeVisible();
  }
});

test("Kanban por toque usa somente a alça", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 1180, height: 820 },
  });
  try {
    const page = await context.newPage();
    await login(page, "cozinha");
    await expect(
      page.getByRole("button", { name: "Iniciar preparo" }),
    ).toBeEnabled();
    const handle = page.getByRole("button", { name: /Arrastar pedido 14/ });
    const origin = await handle.boundingBox();
    const target = await page
      .locator('[data-drop-status="EM_PREPARO"]')
      .boundingBox();
    if (!origin || !target) throw Error("Alça ou coluna ausente");
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        {
          x: origin.x + origin.width / 2,
          y: origin.y + origin.height / 2,
          id: 1,
        },
      ],
    });
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: target.x + target.width / 2, y: target.y + 100, id: 1 },
      ],
    });
    await expect(
      page.locator('[data-drop-status="EM_PREPARO"]'),
    ).toHaveAttribute("data-drop-over", "true");
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.getByRole("button", { name: "Marcar pronto" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("código vencido permite gerar outra solicitação", async ({ page }) => {
  await page.route("**/api/v1/dispositivos/pareamento/*", (route) =>
    route.fulfill({
      status: 410,
      contentType: "application/problem+json",
      body: JSON.stringify({ status: 410 }),
    }),
  );
  await page.goto("/mesa/pareamento");
  await expect(
    page.getByRole("heading", { name: "Este código venceu" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gerar novo código" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos preparar sua mesa" }),
  ).toBeVisible();
});
