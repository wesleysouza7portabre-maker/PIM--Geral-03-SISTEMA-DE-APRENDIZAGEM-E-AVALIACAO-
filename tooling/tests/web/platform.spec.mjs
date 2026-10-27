import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function signup(page, name = "Aluno Navegador") {
  await page.goto("/#login");
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Nome completo", { exact: true }).fill(name);
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(
      `browser-${Date.now()}-${Math.random().toString(16).slice(2)}@educatech.test`,
    );
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Browser!TesteSeguro2026");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("Browser!TesteSeguro2026");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(name.split(" ")[0] + "!") }),
  ).toBeVisible();
}
async function loginAdmin(page) {
  await page.goto("/#login");
  await page.getByLabel("Tipo de acesso").selectOption("Staff");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.TEST_ADMIN_EMAIL);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(
    page.getByRole("link", { name: "Gestão de conteúdo", exact: true }),
  ).toBeVisible();
}
async function openAds(page) {
  await page.getByRole("link", { name: "Disciplinas", exact: true }).click();
  const course = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Análise e Desenvolvimento de Sistemas",
      exact: true,
    }),
  });
  await course.getByRole("button", { name: "Acessar disciplina" }).click();
  await expect(
    page.getByRole("button", { name: /Atividade 1: Introdução/ }),
  ).toBeVisible();
}
test("aluno mantém fluxo de matrícula, conclusão e correção real na interface restaurada", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signup(page);
  await openAds(page);
  await page.getByRole("button", { name: /Atividade 1: Introdução/ }).click();
  await page
    .getByRole("button", { name: "Marcar como concluída" })
    .first()
    .click();
  await expect(page.locator(".activity-row.done")).toHaveCount(1);
  await page.getByRole("link", { name: "Abrir avaliação" }).first().click();
  await page
    .getByRole("radio", { name: /Fornecer rótulos e navegação por teclado/ })
    .check();
  await page.getByRole("button", { name: "Próxima →" }).click();
  await page.getByRole("radio", { name: /Encapsulamento/ }).check();
  await page
    .getByRole("button", { name: "Enviar avaliação", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(
    page.getByText("Sua nota foi registrada com sucesso."),
  ).toBeVisible();
  await expect(page.locator(".score")).toContainText("100");
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("admin mantém gestão de conteúdo, usuários e relatórios em tela estreita", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
  await page
    .getByRole("link", { name: "Gestão de conteúdo", exact: true })
    .click();
  await page
    .locator("#course-form")
    .getByLabel("Título", { exact: true })
    .fill("Disciplina do navegador");
  await page
    .locator("#course-form")
    .getByLabel("Descrição")
    .fill("Conteúdo criado no teste de interface.");
  await page.getByLabel("Publicar no catálogo").check();
  await page.getByRole("button", { name: "Salvar disciplina" }).click();
  await expect(
    page.getByRole("cell", { name: "Disciplina do navegador", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Relatórios", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Relatórios gerenciais" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("cadastro, login e páginas públicas mantêm validações e conteúdos do protótipo", async ({
  page,
}) => {
  await page.goto("/#cursos");
  await expect(
    page.getByRole("heading", { name: "Você está navegando como convidado" }),
  ).toBeVisible();
  await page.goto("/#inicio");
  await expect(page.getByRole("heading", { name: /visitante!/ })).toBeVisible();
  await expect(
    page.getByText("Entre para visualizar seu desempenho."),
  ).toBeVisible();
  await page.goto("/#ajuda");
  await page.getByText("Como emito um certificado?").click();
  await expect(page.getByText(/pelo menos 7 em cada avaliação/)).toBeVisible();
  await page.goto("/#privacidade");
  await expect(page.getByText(/Lei nº 13\.709\/2018/)).toBeVisible();

  await page.goto("/#login");
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Nome completo", { exact: true }).fill("Senha Diferente");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`browser-mismatch-${Date.now()}@educatech.test`);
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Browser!TesteSeguro2026");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("Browser!Diferente2026");
  await page.getByText("Dados pessoais adicionais (opcionais)").click();
  await page.getByLabel("CPF (opcional)").pressSequentially("52998224725");
  await expect(page.getByLabel("CPF (opcional)")).toHaveValue("529.982.247-25");
  await page.getByLabel("Telefone (opcional)").pressSequentially("12999990001");
  await expect(page.getByLabel("Telefone (opcional)")).toHaveValue(
    "(12) 99999-0001",
  );
  await page.getByLabel("CEP (opcional)").pressSequentially("12300000");
  await expect(page.getByLabel("CEP (opcional)")).toHaveValue("12300-000");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByText("As senhas não coincidem.")).toBeVisible();

  await page.getByRole("tab", { name: "Entrar" }).click();
  await page.getByLabel("Tipo de acesso").selectOption("Staff");
  await page.getByLabel("Cargo").selectOption("Teacher");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.TEST_ADMIN_EMAIL);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(
    page.getByText("O cargo selecionado não corresponde à sua conta."),
  ).toBeVisible();
});
test("perfil, calendário, avisos, menu e reinício preservam os fluxos originais", async ({
  page,
}) => {
  await signup(page, "Perfil Restaurado");
  await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
  await page.getByRole("link", { name: /Meus dados Dados pessoais/ }).click();
  await page.getByLabel("Cidade (opcional)").fill("São José dos Campos");
  await page.getByRole("button", { name: "Salvar meus dados" }).click();
  await page.reload();
  await expect(page.getByLabel("Cidade (opcional)")).toHaveValue(
    "São José dos Campos",
  );
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("link", { name: "📅 Calendário", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calendário", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês ›" }).click();
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("link", { name: "🔔 Avisos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aviso institucional" }),
  ).toBeVisible();
  await openAds(page);
  await page.getByRole("button", { name: /Atividade 1: Introdução/ }).click();
  await page
    .getByRole("button", { name: "Marcar como concluída" })
    .first()
    .click();
  await page.getByRole("button", { name: "Reiniciar disciplina" }).click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.getByText(/Ciclo de estudo 2/)).toBeVisible();
  await expect(page.locator(".activity-row.done")).toHaveCount(0);
});
test("quiz restaura navegação, rascunho persistente, cronômetro e imagem do original", async ({
  page,
}) => {
  await signup(page, "Quiz Restaurado");
  await openAds(page);
  await expect(
    page.getByRole("button", { name: /Conclua as atividades anteriores/ }),
  ).toBeDisabled();
  for (const title of [
    /Atividade 1: Introdução/,
    /Atividade 2: Exercícios Práticos/,
  ]) {
    await page.getByRole("button", { name: title }).click();
    await page
      .getByRole("button", { name: "Marcar como concluída" })
      .first()
      .click();
  }
  await page
    .locator("aside .content-block")
    .filter({
      has: page.getByRole("heading", {
        name: "Quiz de Fixação — Análise de Sistemas",
      }),
    })
    .getByRole("link", { name: "Abrir avaliação" })
    .click();
  await expect(page.locator("#quiz-map button")).toHaveCount(5);
  await page.getByRole("radio").first().check();
  await expect(page.locator("#quiz-save-status")).toHaveText("Resposta salva.");
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await expect(page.locator("#quiz-timer")).toHaveText(/\d\d:\d\d/);
  await page
    .getByRole("button", { name: "Ir para questão 3", exact: true })
    .click();
  await expect(page.locator(".quiz-image")).toBeVisible();
  await expect(
    page.getByLabel("Trilha de navegação").getByRole("link", { name: "Disciplinas" }),
  ).toBeVisible();
  await page
    .getByLabel("Navegação principal")
    .getByRole("link", { name: "Início", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Quiz!/ })).toBeVisible();
  await expect(page.locator(".performance-card")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mkdir(".local/visual", { recursive: true });
  await page.screenshot({
    path: ".local/visual/restored-dashboard.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/visual/restored-mobile-width.png",
    animations: "disabled",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
