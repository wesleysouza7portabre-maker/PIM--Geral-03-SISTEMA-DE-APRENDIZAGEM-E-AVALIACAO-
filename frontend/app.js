import { api, authenticate, restore, logout, getSession } from "./api.js";
import {
  escape,
  roles,
  field,
  button,
  head,
  pager,
  profileFields,
  profilePayload,
  applyMask,
  courseForm,
  administration,
  addQuestion,
  manageActivities,
  managedLessons,
  academicUsers,
  studentRecord,
  teacherAssignments,
} from "./academic.js";

const root = document.querySelector("#app");
const user = () => getSession()?.user;
const staff = () => user() && user().role !== "Student";
const coordinator = () => ["Admin", "Coordinator"].includes(user()?.role);
const colors = ["ads", "cc", "design", "ti", "ec"];
const courseStyle = (id) => colors[Number(id.slice(-1)) - 1] || "cc";
const icons = { ads: "💻", cc: "🔬", design: "🎨", ti: "🖧", ec: "⚙" };
const icon = (id) => icons[courseStyle(id)];
// Níveis de medalha do protótipo original (25%, 50% e 100% de progresso).
const medal = (progress) =>
  progress >= 100
    ? "🥇 Concluído"
    : progress >= 50
      ? "🥈 Avançado"
      : progress >= 25
        ? "🥉 Aprendiz"
        : "🏅 Iniciante";
const date = (value) => new Date(value).toLocaleDateString("pt-BR");
const brand = `<a class="brand" href="#inicio" aria-label="EducaTech — página inicial"><img src="/assets/educatech-logo.png" alt="EducaTech"></a>`;
let generation = 0,
  authMode = "login",
  coursePage = 1,
  reportPage = 1,
  userPage = 1,
  academicPage = 1,
  assignmentPage = 1;
let courseData = [],
  lessonData = [],
  reportRows = [],
  quiz = null,
  quizTimer = null,
  toastTimer;
let calendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);
let confirmResolve = null;
function toast(message) {
  document.querySelector("#toast").textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => (document.querySelector("#toast").textContent = ""),
    6500,
  );
}
function navigate(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}
function confirmAction(title, message, label = "Confirmar") {
  const dialog = document.querySelector("#confirmation");
  dialog.innerHTML = `<form method="dialog" class="form"><h2>${escape(title)}</h2><p>${escape(message)}</p><div class="actions"><button class="btn secondary" value="cancel">Cancelar</button><button class="btn" value="confirm">${escape(label)}</button></div></form>`;
  dialog.returnValue = "cancel";
  dialog.showModal();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}
function closeDrawer() {
  document.querySelector("#drawer")?.close();
}
function progress(e) {
  return `<div class="progress-label"><span>${e.completedLessons}/${e.totalLessons} atividades</span><strong>${e.progress}%</strong></div><progress max="100" value="${e.progress}" aria-label="Progresso em ${escape(e.courseTitle)}"></progress>`;
}
function clock() {
  document
    .querySelectorAll("[data-clock]")
    .forEach(
      (el) =>
        (el.textContent = `São ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`),
    );
}
function shell(path) {
  const current = user();
  const links = [
    ["inicio", "Início"],
    ["cursos", "Disciplinas"],
    ...(current
      ? [
          ["perfil", "Meu perfil"],
          ["desempenho", "Meu desempenho"],
        ]
      : []),
    ...(staff()
      ? [
          ["admin", "Gestão de conteúdo"],
          ["academico", "Alunos e notas"],
          ["relatorios", "Relatórios"],
        ]
      : []),
    ...(current?.role === "Admin" ? [["usuarios", "Usuários"]] : []),
  ];
  root.innerHTML = `<header class="global-nav"><div class="nav-start"><button type="button" class="btn secondary" data-action="menu" aria-label="Abrir menu">☰</button><div class="history-arrows"><button class="round-btn" data-action="back" aria-label="Voltar página">‹</button><button class="round-btn" data-action="forward" aria-label="Avançar página">›</button></div></div>${brand}<div class="nav-user">${
    current
      ? `<a class="user-chip" href="#perfil"><span class="avatar" aria-hidden="true">${escape(
          current.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join(""),
        )}</span><span><strong>${escape(current.name)}</strong><small>${roles[current.role]}</small></span></a>${button("Sair", "logout", "", true)}`
      : '<a class="btn" href="#login">Entrar na plataforma</a>'
  }</div></header><nav class="app-tabs" aria-label="Navegação principal">${links.map(([href, label]) => `<a href="#${href}" ${path === href ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav><main class="workspace" id="main-content" tabindex="-1"><p class="loading" role="status">Carregando…</p></main><footer class="site-footer">EducaTech · Sistema de Avaliação e Aprendizado Integrado <a href="#acessibilidade">Acessibilidade e convivência</a></footer>`;
  const drawer = document.querySelector("#drawer");
  drawer.innerHTML = `<div class="drawer-head"><strong>EducaTech</strong><button class="round-btn" data-action="close-menu" aria-label="Fechar menu">×</button></div><nav aria-label="Menu do perfil">${[...links, ["calendario", "📅 Calendário"], ["avisos", "🔔 Avisos"], ["certificados", "🎓 Certificados"], ["privacidade", "🔒 Política de privacidade"], ["quem-somos", "🏢 Quem somos?"], ["ajuda", "❓ Ajuda"]].map(([href, label]) => `<a href="#${href}">${label}</a>`).join("")}${current ? button("Sair da conta", "logout", "", true) : '<a href="#login">Entrar</a>'}</nav>`;
  return document.querySelector("#main-content");
}
function authScreen() {
  root.innerHTML = `<main class="auth-wrap" id="main-content"><div class="auth-logo">${brand}<p>SISTEMA DE AVALIAÇÃO E APRENDIZADO INTEGRADO</p></div><section class="auth-card"><h1>${authMode === "login" ? "Bem-vindo de volta!" : "Faça parte da EducaTech"}</h1><p class="muted">${authMode === "login" ? "Entre na sua conta para continuar aprendendo." : "Sua jornada de conhecimento começa aqui."}</p><div class="tabs" role="tablist" aria-label="Acesso"><button role="tab" data-action="login-mode" aria-selected="${authMode === "login"}">Entrar</button><button role="tab" data-action="register-mode" aria-selected="${authMode === "register"}">Criar conta</button></div><form class="form" id="auth-form">${authMode === "register" ? field("Nome completo", "name", "text", "", 'required maxlength="120" autocomplete="name"') : '<label class="field">Tipo de acesso<select name="context"><option value="Student">Aluno</option><option value="Staff">Instituição — Professor, Coordenador ou Administrador</option></select></label><label class="field" id="cargo-field" hidden>Cargo<select name="cargo"><option value="">Selecione seu cargo (opcional)</option><option value="Teacher">Professor</option><option value="Coordinator">Coordenador</option><option value="Admin">Administrador</option></select></label>'}${field("E-mail", "email", "email", "", 'required maxlength="254" autocomplete="username"')}<div class="password-group">${field("Senha", "password", "password", "", 'required maxlength="128" autocomplete="' + (authMode === "login" ? "current-password" : "new-password") + '"')}${button("Mostrar senha", "show-password", "", true)}</div>${authMode === "register" ? `${field("Confirmar senha", "confirmPassword", "password", "", 'required maxlength="128" autocomplete="new-password"')}<small>Use 12 a 128 caracteres, maiúscula, minúscula, número e símbolo. O cadastro público cria uma conta de aluno.</small><details><summary>Dados pessoais adicionais (opcionais)</summary><div class="content-block">${profileFields()}</div></details>` : '<a href="#recuperar">Esqueci minha senha</a>'}<p id="auth-error" class="notice error" role="alert" hidden></p><button class="btn full" type="submit">${authMode === "login" ? "Entrar na minha conta" : "Criar minha conta"}</button></form><p class="auth-back"><a href="#cursos">Explorar disciplinas sem entrar</a></p></section><p class="auth-copyright">© ${new Date().getFullYear()} EducaTech</p></main>`;
}
async function home() {
  const [courses, enrollments, performance, certificates] = await Promise.all([
    api("/courses"),
    user() ? api("/me/enrollments") : [],
    user() ? api("/me/performance") : [],
    user() ? api("/me/certificates") : [],
  ]);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const active = enrollments.find((e) => e.progress < 100) || enrollments[0];
  const suggested =
    courses.find((c) => !enrollments.some((e) => e.courseId === c.id)) ||
    courses[0];
  const average = performance.length
    ? Math.round(
        performance.reduce((sum, p) => sum + p.progress, 0) /
          performance.length,
      )
    : 0;
  const performanceBox = !user()
    ? '<div class="locked-area"><span class="lock-icon" aria-hidden="true">🔒</span><p>Entre para visualizar seu desempenho.</p></div><a class="btn full" href="#login">Entre ou registre-se</a>'
    : `${performance.length ? `<p class="perf-avg">Progresso médio: <strong>${average}%</strong></p><progress max="100" value="${average}" aria-label="Progresso médio"></progress>${performance.map((p) => `<div class="performance-item"><span>${icon(p.courseId)} ${escape(p.courseTitle)}</span><div class="progress-label"><strong>${p.progress}%</strong><span>Nota: ${p.grade ?? "—"}/10</span></div><progress max="100" value="${p.progress}" aria-label="Progresso em ${escape(p.courseTitle)}"></progress><small>${medal(p.progress)}</small></div>`).join("")}` : '<p class="muted">Matricule-se em uma disciplina para acompanhar seu progresso.</p>'}<a class="btn full" href="#desempenho">Ver relatório detalhado</a>`;
  return `${head("BEM-VINDO À EDUCATECH", `${greeting}, ${user()?.name.split(" ")[0] || "visitante"}! 👋`, user() ? "Bem-vindo(a) de volta à sua jornada de aprendizagem." : "Explore nossas disciplinas ou faça login para acompanhar seu progresso.")}<p class="home-clock" data-clock></p><div class="dashboard"><section class="stack"><div class="home-top"><article class="card suggestion-card"><span class="suggestion-icon" aria-hidden="true">📚</span><div><p class="eyebrow">SUGESTÃO PARA VOCÊ</p><h2>Que tal começar por ${escape(suggested?.title || "uma nova disciplina")}?</h2><a class="btn" href="#cursos">Ver disciplinas</a></div></article>${active ? `<article class="card"><p class="eyebrow">CONTINUAR DE ONDE PAREI</p><h2>${escape(active.courseTitle)}</h2>${progress(active)}<a class="btn small" href="#curso/${active.courseId}">Continuar ▶</a></article>` : ""}</div><section><div class="section-heading"><h2>DISCIPLINAS DISPONÍVEIS</h2><a href="#cursos">Ver todas ›</a></div><div class="quick-courses">${courses
    .slice(0, 5)
    .map(
      (c) =>
        `<button class="mini-course course-${courseStyle(c.id)}" data-action="open-course" data-id="${c.id}"><span aria-hidden="true">${icon(c.id)}</span><strong>${escape(c.title)}</strong></button>`,
    )
    .join(
      "",
    )}</div></section><div class="home-bottom"><article class="card"><h2>🎓 Certificados</h2><p>${certificates.length ? `Você possui ${certificates.length} certificado(s) disponível(is).` : "Conclua as atividades e avaliações para conquistar seu certificado."}</p><a class="btn secondary" href="#certificados">Ver certificados</a></article><article class="card"><h2>💬 Comunidade</h2><p>Aprender também é trocar experiências e respeitar diferentes histórias.</p><a class="btn secondary" href="#comunidade">Acessar comunidade</a></article></div></section><aside class="card performance-card"><h2>📊 Meu desempenho</h2>${performanceBox}</aside></div>`;
}
async function catalog() {
  courseData = await api(`/courses?page=${coursePage}`);
  const enrollments = user() ? await api("/me/enrollments") : [];
  return `${head("SUA JORNADA ACADÊMICA", "Disciplinas", "Explore seus conhecimentos em uma plataforma integrada.")}<div class="grid">${
    courseData
      .map((c) => {
        const e = enrollments.find((e) => e.courseId === c.id);
        return `<article class="card course-card course-${courseStyle(c.id)}"><header class="discipline-head"><span class="discipline-icon" aria-hidden="true">${icon(c.id)}</span><div><h2>${escape(c.title)}</h2><p>${c.lessonCount} atividades${c.published ? "" : " · Rascunho"}</p></div></header><div class="discipline-body"><p class="muted">${escape(c.description)}</p>${e ? progress(e) : '<p class="muted">Sua próxima conquista começa aqui.</p>'}<div class="course-foot"><span class="medal">${medal(e?.progress || 0)}</span>${button(user()?.role === "Student" ? "Acessar disciplina" : "Ver conteúdo", "open-course", c.id)}</div></div></article>`;
      })
      .join("") || '<p class="card">Nenhuma disciplina disponível.</p>'
  }</div>${pager(coursePage, courseData.length, "courses")}${user() ? "" : '<aside class="card guest-notice" aria-label="Aviso para visitantes"><h2>Você está navegando como convidado</h2><p>Faça login ou cadastre-se para acessar as disciplinas e acompanhar seu progresso.</p><a class="btn" href="#login">Entrar na plataforma</a></aside>'}`;
}
async function detail(id) {
  const [lessons, assessments, enrollments, courses] = await Promise.all([
    api(`/courses/${id}/lessons`),
    api(`/courses/${id}/assessments`),
    api("/me/enrollments"),
    api("/courses"),
  ]);
  lessonData = lessons;
  const enrollment = enrollments.find((e) => e.courseId === id);
  const course = courses.find((c) => c.id === id);
  const modules = Map.groupBy(lessons, (l) => l.moduleId);
  const next = lessons.find((l) => !l.completed && l.available);
  return `${head("DISCIPLINAS / ATIVIDADES", course?.title || "Atividades da disciplina", "Conclua as atividades para avançar na sua aprendizagem.", `${user().role === "Student" ? button("Continuar de onde parei", "continue-course", next?.id || "") + button("Reiniciar disciplina", "restart-course", id, true) : course?.canManage ? `<a class="btn" href="#gerenciar/${id}">Gerenciar atividades</a>` : ""}`)}<div class="split"><section class="stack">${enrollment ? `<article class="card">${progress(enrollment)}<small>Ciclo de estudo ${enrollment.learningCycle} · ${medal(enrollment.progress)}</small></article>` : ""}${[...modules.values()].map((ls) => `<section class="card unit-block"><header class="unit-head"><h2>Unidade ${ls[0].modulePosition}</h2><span>${escape(ls[0].moduleTitle)}</span></header><div class="activity-list">${ls.map((l) => `<article class="activity-row ${l.completed ? "done" : !l.available ? "locked" : ""}"><button class="activity-button" data-action="read-lesson" data-id="${l.id}" ${!l.available ? "disabled" : ""}><span>${l.completed ? "✓" : l.available ? "○" : "🔒"} ${escape(l.title)}</span><span aria-hidden="true">›</span></button>${!l.available ? `<p class="muted">${l.availableFrom && new Date(l.availableFrom) > new Date() ? `Disponível em ${new Date(l.availableFrom).toLocaleString("pt-BR")}` : "Conclua a atividade anterior para desbloquear."}</p>` : `<details id="lesson-${l.id}"><summary>Ler atividade</summary><p class="lesson-content">${escape(l.content)}</p>${user().role === "Student" && !l.completed ? button("Marcar como concluída", "complete", l.id) : ""}</details>`}</article>`).join("")}</div><div class="unit-foot"><progress max="${ls.length}" value="${ls.filter((l) => l.completed).length}" aria-label="Progresso da unidade ${ls[0].modulePosition}"></progress><span>${Math.round((ls.filter((l) => l.completed).length / ls.length) * 100)}% concluído</span></div></section>`).join("") || '<p class="card">Nenhuma atividade cadastrada.</p>'}</section><aside class="card"><h2>📝 Avaliações</h2>${assessments.map((a) => `<div class="content-block"><h3>${escape(a.title)}</h3><p class="muted">${a.questions} questões · correção automática</p>${a.available ? `<a class="btn small" href="#avaliacao/${a.id}">Abrir avaliação</a>` : `<button class="btn secondary" disabled>🔒 Conclua as atividades anteriores</button>`}</div>`).join("") || '<p class="muted">Nenhuma avaliação cadastrada.</p>'}</aside></div>`;
}
async function assessment(id, run) {
  const [data, courses] = await Promise.all([
    api(`/assessments/${id}`),
    api("/courses"),
  ]);
  const course = courses.find((c) => c.id === data.courseId);
  const session =
    user().role === "Student"
      ? await api(`/assessments/${id}/sessions`, { method: "POST" })
      : null;
  if (run !== generation) return "";
  quiz = {
    data,
    session,
    index: 0,
    answers: new Map(
      session?.answers.map((a) => [a.questionId, a.optionId]) || [],
    ),
    operationId: session?.id || crypto.randomUUID(),
    saving: Promise.resolve(),
    busy: false,
    offset: session ? new Date(session.serverTime).getTime() - Date.now() : 0,
  };
  return `<nav class="breadcrumb" aria-label="Trilha de navegação"><a href="#inicio">Início</a><span aria-hidden="true">›</span><a href="#cursos">Disciplinas</a><span aria-hidden="true">›</span><a href="#curso/${data.courseId}">${escape(course?.title || "Disciplina")}</a><span aria-hidden="true">›</span><span aria-current="page">${escape(data.title)}</span></nav>${head("QUIZ DE FIXAÇÃO", data.title, `${data.questions.length} questões · ${data.timeLimitMinutes} minutos · sua nota será registrada no servidor.`)}<form id="attempt-form" class="quiz-grid"><section class="card" id="quiz-question"></section><aside class="card quiz-sidebar"><h2>Mapa de questões</h2><div id="quiz-map" class="quiz-map"></div><div class="actions">${button("← Anterior", "quiz-prev", "", true)}${button("Próxima →", "quiz-next", "", true)}</div><p>Tempo restante <strong id="quiz-timer" role="timer">—</strong></p><p id="quiz-save-status" aria-live="polite" class="muted">Respostas salvas durante a avaliação.</p>${session ? '<button class="btn danger full" type="submit">Enviar avaliação</button>' : '<p class="notice">Visualização da equipe. Apenas alunos podem enviar respostas.</p>'}</aside></form>`;
}
function showQuizQuestion() {
  if (!quiz || !document.querySelector("#quiz-question")) return;
  const q = quiz.data.questions[quiz.index];
  const total = quiz.data.questions.length;
  document.querySelector("#quiz-question").innerHTML =
    `<div class="quiz-progress"><progress max="${total}" value="${quiz.index + 1}" aria-label="Questão ${quiz.index + 1} de ${total}"></progress><div class="progress-label"><span class="badge">Questão ${quiz.index + 1} de ${total}</span><span>Valor: <strong>${(10 / total).toFixed(1)}</strong> ponto(s)</span></div></div><fieldset class="question"><legend>${escape(q.prompt)}</legend>${q.imagePath?.startsWith("/assets/") ? `<img class="quiz-image" src="${escape(q.imagePath)}" alt="${escape(q.imageAlt)}">` : ""}${q.options.map((o, i) => `<label class="option ${quiz.answers.get(q.id) === o.id ? "selected" : ""}"><input type="radio" name="answer" data-quiz-question="${q.id}" value="${o.id}" ${quiz.answers.get(q.id) === o.id ? "checked" : ""} ${!quiz.session || quiz.busy ? "disabled" : ""}><span><small>Alternativa ${String.fromCharCode(65 + i)}</small>${escape(o.text)}</span></label>`).join("")}</fieldset>`;
  document.querySelector("#quiz-map").innerHTML = quiz.data.questions
    .map(
      (q, i) =>
        `<button type="button" class="quiz-map-btn ${i === quiz.index ? "current" : ""} ${quiz.answers.has(q.id) ? "answered" : ""}" data-action="quiz-goto" data-id="${i}" aria-label="Ir para questão ${i + 1}" ${i === quiz.index ? 'aria-current="step"' : ""}>${i + 1}</button>`,
    )
    .join("");
  document.querySelector("[data-action=quiz-prev]").disabled = quiz.index === 0;
  document.querySelector("[data-action=quiz-next]").disabled =
    quiz.index === quiz.data.questions.length - 1;
}
function tickQuiz() {
  if (!quiz?.session || !document.querySelector("#quiz-timer")) return;
  const remaining = Math.max(
    0,
    Math.ceil(
      (new Date(quiz.session.deadline).getTime() - Date.now() - quiz.offset) /
        1000,
    ),
  );
  document.querySelector("#quiz-timer").textContent =
    `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  if (remaining === 0 && !quiz.busy)
    finishQuiz(true).catch((error) => toast(error.message));
}
async function finishQuiz(automatic = false) {
  const current = quiz;
  if (!current?.session || current.busy) return;
  current.busy = true;
  if (
    !automatic &&
    !(await confirmAction(
      "Enviar avaliação?",
      `Você respondeu ${current.answers.size} de ${current.data.questions.length} questões. Questões não respondidas valem zero.`,
      "Confirmar envio",
    ))
  ) {
    current.busy = false;
    return;
  }
  if (quiz !== current) return;
  clearInterval(quizTimer);
  try {
    await current.saving;
    const result = await api(`/assessments/${current.data.id}/attempts`, {
      method: "POST",
      body: {
        operationId: current.operationId,
        sessionId: current.session.id,
        answers: [...current.answers].map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      },
    });
    if (quiz !== current) return;
    document.querySelector("#attempt-form").innerHTML =
      `<article class="card quiz-result"><span class="result-icon" aria-hidden="true">🎉</span><p class="eyebrow">AVALIAÇÃO CONCLUÍDA</p><h2>Mais um passo na sua jornada!</h2><p class="score">${result.score}<small> / 100</small></p><p>Nota: ${(result.score / 10).toFixed(1)} / 10</p><p>Sua nota foi registrada com sucesso.</p>${automatic ? "<p>O tempo foi encerrado. Foram consideradas as respostas salvas antes do prazo.</p>" : ""}<a class="btn" href="#desempenho">Ver meu desempenho</a></article>`;
  } catch (error) {
    current.busy = false;
    throw error;
  }
}
async function profile() {
  const p = await api("/me/profile");
  const links = [
    ["meus-dados", "👤", "Meus dados", "Dados pessoais e matrícula"],
    [
      "desempenho",
      "📊",
      "Minhas notas e frequência",
      "Seu relatório de desempenho",
    ],
    ["calendario", "📅", "Calendário", "Agenda de atividades"],
    ["avisos", "🔔", "Avisos", "Comunicados da instituição"],
    ["certificados", "🎓", "Certificados", "Suas conquistas acadêmicas"],
    ...(staff()
      ? [
          [
            "admin",
            "📚",
            "Gerenciar cursos",
            "Conteúdo, atividades e avaliações",
          ],
          ["academico", "👥", "Alunos e notas", "Acompanhamento acadêmico"],
          [
            "relatorios",
            "📈",
            "Relatórios gerenciais",
            "Indicadores da instituição",
          ],
        ]
      : []),
    ...(user().role === "Admin"
      ? [
          [
            "usuarios",
            "⚙",
            "Administrar usuários",
            "Perfis e controle de acesso",
          ],
        ]
      : []),
  ];
  return `${head("MEU PERFIL", p.name, `${roles[p.role]} · Matrícula: ${p.registrationNumber}`)}<div class="profile-hero"><span class="profile-avatar" aria-hidden="true">${escape(
    p.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join(""),
  )}</span><div><h2>${escape(p.name)}</h2><p>${escape(p.email)}</p><span class="badge">${roles[p.role]}</span></div></div><div class="profile-grid">${links.map(([href, ico, title, sub]) => `<a href="#${href}" class="card profile-menu-item"><span aria-hidden="true">${ico}</span><div><h2>${title}</h2><p>${sub}</p></div><span aria-hidden="true">›</span></a>`).join("")}</div>`;
}
async function personal() {
  const p = await api("/me/profile");
  return `${head("MEU PERFIL", "Meus dados", `Matrícula ${p.registrationNumber} · ${roles[p.role]}`)}<form id="profile-form" class="card form"><p>E-mail de acesso: <strong>${escape(p.email)}</strong></p>${field("Nome completo", "name", "text", p.name, 'required maxlength="120"')}${profileFields(p)}<button class="btn" type="submit">Salvar meus dados</button></form>`;
}
async function performance() {
  const [rows, attempts] = await Promise.all([
    api("/me/performance"),
    api("/me/attempts"),
  ]);
  const average = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / rows.length)
    : 0;
  return `${head("MEU APRENDIZADO", "Relatório de desempenho", "Notas, frequência, progresso e histórico de avaliações.")}<section class="card"><h2>Progresso médio</h2><p class="stat">${average}%</p><progress max="100" value="${average}" aria-label="Progresso médio"></progress></section><section class="card table-wrap content-block"><table><caption>Por disciplina</caption><thead><tr><th>Disciplina</th><th>Progresso</th><th>Nota (0–10)</th><th>Frequência</th><th>Conquista</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${icon(r.courseId)} ${escape(r.courseTitle)}</td><td>${r.progress}%</td><td>${r.grade ?? "Não avaliado"}</td><td>${r.attendance === null ? "Não informada" : r.attendance + "%"}</td><td>${medal(r.progress)}</td></tr>`).join("") || '<tr><td colspan="5">Matricule-se em uma disciplina para começar.</td></tr>'}</tbody></table></section><section class="card table-wrap content-block"><table><caption>Histórico de avaliações</caption><thead><tr><th>Data</th><th>Avaliação</th><th>Nota (0–10)</th></tr></thead><tbody>${attempts.map((a) => `<tr><td>${new Date(a.submittedAt).toLocaleString("pt-BR")}</td><td><a href="#avaliacao/${a.assessmentId}">Ver avaliação</a></td><td>${(a.score / 10).toFixed(1)}</td></tr>`).join("") || '<tr><td colspan="3">Nenhuma avaliação enviada.</td></tr>'}</tbody></table></section>`;
}
async function notices() {
  const rows = await api("/announcements");
  return `${head("COMUNICAÇÃO", "Avisos", "Comunicados publicados pela coordenação e administração.")}<div class="stack">${coordinator() ? `<form id="notice-form" class="card form"><h2>Enviar novo aviso</h2>${field("Título", "title", "text", "", 'required maxlength="160"')}<label class="field">Comunicado<textarea name="content" required maxlength="4000"></textarea></label><button class="btn" type="submit">Publicar aviso</button></form>` : ""}${rows.map((n) => `<article class="card"><p class="eyebrow">${date(n.createdAt)} · ${escape(n.authorName)}</p><h2>${escape(n.title)}</h2><p class="lesson-content">${escape(n.content)}</p></article>`).join("") || '<p class="card">Nenhum aviso publicado.</p>'}</div>`;
}
async function calendar() {
  const from = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ),
    until = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const rows = await api(
    `/calendar?from=${encodeURIComponent(from.toISOString())}&until=${encodeURIComponent(until.toISOString())}`,
  );
  const days = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const today = new Date();
  return `${head("MINHA AGENDA", "Calendário", "Acompanhe as datas publicadas pela instituição.")}<section class="card"><div class="section-heading">${button("‹ Mês anterior", "calendar-prev", "", true)}<h2>${escape(from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</h2>${button("Próximo mês ›", "calendar-next", "", true)}</div><div class="calendar-grid">${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => `<strong>${d}</strong>`).join("")}${Array.from({ length: from.getDay() }, () => "<span></span>").join("")}${Array.from(
    { length: days },
    (_, i) => {
      const current = new Date(from.getFullYear(), from.getMonth(), i + 1);
      const end = new Date(current);
      end.setDate(end.getDate() + 1);
      const events = rows.filter(
        (e) => new Date(e.startsAt) < end && new Date(e.endsAt) >= current,
      );
      return `<div class="calendar-day ${current.toDateString() === today.toDateString() ? "today" : ""}"><strong>${i + 1}</strong>${events.map((e) => `<span class="calendar-event">${escape(e.title)}</span>`).join("")}</div>`;
    },
  ).join(
    "",
  )}</div></section><section class="stack content-block">${rows.map((e) => `<article class="card"><h2>${escape(e.title)}</h2><p>${new Date(e.startsAt).toLocaleString("pt-BR")} — ${new Date(e.endsAt).toLocaleString("pt-BR")}</p><p>${escape(e.description)}</p></article>`).join("") || '<p class="card">Nenhum evento neste mês.</p>'}${staff() ? `<form id="calendar-form" class="card form"><h2>Adicionar ao calendário</h2>${field("Título", "title", "text", "", 'required maxlength="160"')}<label class="field">Descrição<textarea name="description" required maxlength="2000"></textarea></label><div class="form-row">${field("Início", "startsAt", "datetime-local", "", "required")}${field("Fim", "endsAt", "datetime-local", "", "required")}</div><button class="btn" type="submit">Salvar evento</button></form>` : ""}</section>`;
}
async function certificates() {
  const rows = await api("/me/certificates");
  return `${head("MINHAS CONQUISTAS", "Certificados", "Conclua as atividades e obtenha pelo menos 7 em cada avaliação da disciplina.")}<div class="grid">${rows.map((c) => `<article class="card"><span class="result-icon" aria-hidden="true">🎓</span><h2>${escape(c.courseTitle)}</h2><p>${c.workloadHours} horas · ${date(c.issuedAt)}</p><a class="btn" href="#certificado/${c.id}">Visualizar e imprimir certificado</a></article>`).join("") || '<p class="card">Você ainda não possui certificados. Continue sua jornada de aprendizagem!</p>'}</div>`;
}
async function certificate(id) {
  const c = await api(`/certificates/${id}`);
  return `<div class="actions print-controls">${button("Imprimir / Salvar PDF", "print-certificate")}<a class="btn secondary" href="#certificados">Meus certificados</a></div><article class="certificate"><img src="/assets/educatech-logo.png" alt="EducaTech"><p class="eyebrow">EDUCATECH SOLUTIONS</p><h1>Certificado de conclusão</h1><p>Certificamos que</p><h2>${escape(c.studentName)}</h2><p>concluiu as atividades e os requisitos de aprovação da disciplina</p><h3>${escape(c.courseTitle)}</h3><p>Carga horária prevista: ${c.workloadHours} horas</p><p>Emitido em ${date(c.issuedAt)} · Ciclo ${c.learningCycle}</p><small>Identificador verificável: ${c.id}</small><p class="muted">Certificado da plataforma acadêmica de demonstração EducaTech SAAI.</p></article>`;
}
async function users() {
  const data = await api(`/users?page=${userPage}`);
  return `${head("ADMINISTRAÇÃO", "Gestão de usuários", "Gerencie os perfis e a situação das contas.")}<div class="card table-wrap"><table><caption>Contas da plataforma</caption><thead><tr><th>Nome / E-mail</th><th>Perfil</th><th>Ativo</th><th>Ação</th></tr></thead><tbody>${data
    .map(
      (u) =>
        `<tr><td>${escape(u.name)}<br><small>${escape(u.email)}</small></td><td><select aria-label="Perfil de ${escape(u.name)}" ${u.id === user().id ? "disabled" : ""}>${Object.entries(
          roles,
        )
          .map(
            ([key, label]) =>
              `<option value="${key}" ${key === u.role ? "selected" : ""}>${label}</option>`,
          )
          .join(
            "",
          )}</select></td><td><input type="checkbox" aria-label="Conta ativa: ${escape(u.name)}" ${u.active ? "checked" : ""} ${u.id === user().id ? "disabled" : ""}></td><td>${u.id === user().id ? "Sua conta" : button("Salvar", "save-user", u.id, true)}</td></tr>`,
    )
    .join("")}</tbody></table>${pager(userPage, data.length, "users")}</div>`;
}
async function reports() {
  reportRows = await api(`/reports/courses?page=${reportPage}`);
  return `${head("PAINEL DA INSTITUIÇÃO", "Relatórios gerenciais", "Matrículas e médias de progresso e tentativas.", button("Exportar página CSV", "csv", "", true))}<div class="card table-wrap"><table><caption>Desempenho por disciplina</caption><thead><tr><th>Disciplina</th><th>Matrículas</th><th>Progresso médio</th><th>Nota média (0–10)</th></tr></thead><tbody>${reportRows.map((r) => `<tr><td>${escape(r.courseTitle)}</td><td>${r.students}</td><td>${r.averageProgress}%</td><td>${r.averageScore === null ? "Sem avaliações" : (r.averageScore / 10).toFixed(1)}</td></tr>`).join("")}</tbody></table>${pager(reportPage, reportRows.length, "reports")}</div>`;
}
function information(path) {
  // Perguntas frequentes recuperadas do protótipo e ajustadas ao funcionamento atual.
  const faq = [
    [
      "Como faço minha matrícula na plataforma?",
      "Na tela de acesso, escolha Criar conta e informe nome, e-mail e senha. Depois abra Disciplinas e selecione Acessar disciplina para se matricular.",
    ],
    [
      "Esqueci minha senha. O que faço?",
      "Na tela de login, clique em Esqueci minha senha. A recuperação automática por e-mail ainda não está disponível: a administração da instituição valida sua identidade e restabelece o acesso.",
    ],
    [
      "Como acompanho meu desempenho?",
      "Acesse Meu perfil e abra Minhas notas e frequência para visualizar progresso, notas, frequência e o histórico de avaliações.",
    ],
    [
      "Como emito um certificado?",
      "Conclua todas as atividades da disciplina e obtenha pelo menos 7 em cada avaliação. O certificado aparece em Certificados, onde pode ser visualizado e impresso ou salvo em PDF.",
    ],
    [
      "O que concluo no aplicativo aparece na Web?",
      "Sim. O aplicativo guarda as conclusões feitas sem conexão e as envia ao servidor quando a internet retorna, sem duplicar registros.",
    ],
    [
      "Como entro em contato com o suporte?",
      "Procure a coordenação da sua turma ou a administração da instituição.",
    ],
  ];
  const paragraphs = (...items) => items.map((p) => `<p>${p}</p>`).join("");
  const contents = {
    "quem-somos": [
      "Quem somos?",
      paragraphs(
        "A <strong>EducaTech Solutions</strong> é a empresa fictícia de tecnologia educacional do projeto PIM, dedicada a transformar o aprendizado por meio da tecnologia. Nasceu com o propósito de democratizar o acesso ao ensino de qualidade, oferecendo cursos, avaliações e acompanhamento personalizado.",
        "Nossa missão é unir educação e inovação, criando experiências de aprendizagem envolventes, acessíveis e alinhadas às demandas do mercado. O SAAI reúne aprendizagem, avaliações e acompanhamento acadêmico em um ambiente integrado.",
        "Acreditamos que aprender deve ser simples, contínuo e prazeroso. Por isso, a plataforma é intuitiva, responsiva, disponível na Web e no aplicativo móvel, e construída com foco no aluno.",
      ),
    ],
    privacidade: [
      "Política de privacidade",
      paragraphs(
        "A <strong>EducaTech</strong> respeita a sua privacidade e está comprometida com a proteção dos dados pessoais de alunos, professores e demais usuários da plataforma.",
        "Nome e e-mail identificam sua conta. CPF, telefone, endereço, cidade, UF e CEP são opcionais e podem ser alterados em Meus dados. Progresso, notas, frequência e certificados são utilizados para matrícula, acompanhamento acadêmico, emissão de certificados e comunicação institucional, e ficam visíveis somente para a equipe autorizada.",
        "Em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>, você pode solicitar à instituição o acesso, a correção, a atualização e a exclusão dos seus dados pessoais, respeitada a guarda do histórico acadêmico exigida por lei.",
        "As senhas são armazenadas apenas em formato protegido (hash) e os ajustes de notas ficam registrados em auditoria. Os dados não são compartilhados com terceiros sem consentimento, salvo nos casos previstos em lei.",
        "Dúvidas e solicitações sobre dados pessoais devem ser encaminhadas ao encarregado de dados da instituição responsável.",
      ),
    ],
    ajuda: [
      "Ajuda",
      `<h2 class="faq-subtitle">Perguntas frequentes</h2><ul class="faq-list">${faq.map(([q, a]) => `<li><details><summary>${q}</summary><p>${a}</p></details></li>`).join("")}</ul>`,
    ],
    comunidade: [
      "Comunidade",
      "Valorizamos a troca de experiências, a diversidade e o respeito. O protótipo original não possuía um fórum implementado. A comunicação disponível nesta versão é feita pelos Avisos e pelo Calendário da instituição.",
    ],
    recuperar: [
      "Recuperar acesso",
      "A recuperação automática por e-mail não estava implementada no protótipo e não há serviço de e-mail configurado. Procure a administração da instituição para validar sua identidade e recuperar o acesso. Nunca compartilhe sua senha.",
    ],
    acessibilidade: [
      "Acessibilidade e convivência",
      "Use Tab e Enter para navegar. Amplie o texto pelo navegador conforme sua necessidade. A interface respeita movimento reduzido e identifica campos e mensagens para tecnologias assistivas. Respeitamos pessoas negras, indígenas e de todas as origens, religiões, identidades de gênero e condições sociais. Conteúdo discriminatório não é aceito. Relate barreiras de acesso e discriminação à coordenação, com acolhimento e sigilo.",
    ],
  };
  const [title, text] = contents[path];
  return `${head("EDUCATECH", title, "Educação, tecnologia e inclusão.")}<article class="card text-page">${text.startsWith("<") ? text : `<p>${text}</p>`}${path === "recuperar" ? '<a class="btn" href="#login">Voltar ao login</a>' : ""}</article>`;
}

async function render() {
  const run = ++generation;
  clearInterval(quizTimer);
  quiz = null;
  closeDrawer();
  const [rawPath, id] = location.hash.slice(1).split("/");
  const path = rawPath || "inicio";
  if (path === "login") {
    authScreen();
    return;
  }
  const publicPaths = [
    "inicio",
    "cursos",
    "acessibilidade",
    "quem-somos",
    "privacidade",
    "ajuda",
    "comunidade",
    "recuperar",
    "certificado",
  ];
  if (!user() && !publicPaths.includes(path)) {
    navigate("login");
    return;
  }
  const main = shell(path);
  try {
    if (
      ([
        "admin",
        "academico",
        "relatorios",
        "gerenciar",
        "aluno",
        "professor",
      ].includes(path) &&
        !staff()) ||
      (path === "usuarios" && user()?.role !== "Admin") ||
      (path === "professor" && !coordinator())
    )
      throw new Error("Seu perfil não possui acesso a esta página.");
    const pages = {
      inicio: home,
      cursos: catalog,
      curso: () => detail(id),
      avaliacao: () => assessment(id, run),
      perfil: profile,
      "meus-dados": personal,
      desempenho: performance,
      admin: () => administration(coursePage),
      gerenciar: () => manageActivities(id),
      academico: () => academicUsers(academicPage, user().role),
      aluno: () => studentRecord(id),
      professor: () => teacherAssignments(id, assignmentPage),
      usuarios: users,
      relatorios: reports,
      calendario: calendar,
      avisos: notices,
      certificados: certificates,
      certificado: () => certificate(id),
    };
    const content = await (
      pages[path] ||
      (() => information(publicPaths.includes(path) ? path : "ajuda"))
    )();
    if (run !== generation) return;
    main.innerHTML = content;
    document.title = `EducaTech | ${main.querySelector("h1")?.textContent || "Aprendizagem"}`;
    main.focus({ preventScroll: true });
    clock();
    if (path === "avaliacao") {
      showQuizQuestion();
      tickQuiz();
      quizTimer = setInterval(tickQuiz, 1000);
    }
  } catch (error) {
    if (run === generation)
      main.innerHTML = `<div class="notice error" role="alert">${escape(error.message)}</div><p><a href="#cursos">Voltar às disciplinas</a></p>`;
  }
}
function downloadCsv() {
  const cell = (v) =>
    `"${String(v ?? "")
      .replace(/^([\s]*[=+\-@])/, "'$1")
      .replaceAll('"', '""')}"`;
  const text =
    "\uFEFF" +
    [
      ["Disciplina", "Matrículas", "Progresso médio", "Nota média (0–100)"],
      ...reportRows.map((r) => [
        r.courseTitle,
        r.students,
        r.averageProgress,
        r.averageScore,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "educatech-relatorio.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function handleAction(target) {
  const { action, id } = target.dataset;
  if (action === "menu") {
    document.querySelector("#drawer").showModal();
    return;
  }
  if (action === "close-menu") {
    closeDrawer();
    return;
  }
  if (action === "back") {
    history.back();
    return;
  }
  if (action === "forward") {
    history.forward();
    return;
  }
  if (action === "login-mode" || action === "register-mode") {
    authMode = action === "login-mode" ? "login" : "register";
    authScreen();
    return;
  }
  if (action === "show-password") {
    const hidden =
      document.querySelector("input[name=password]").type === "text";
    document
      .querySelectorAll("input[name=password], input[name=confirmPassword]")
      .forEach((input) => (input.type = hidden ? "password" : "text"));
    target.textContent = hidden ? "Mostrar senha" : "Ocultar senha";
    return;
  }
  if (action === "add-question") {
    addQuestion();
    return;
  }
  if (action === "logout") {
    if (
      await confirmAction(
        "Sair da conta?",
        "Você poderá entrar novamente para continuar sua jornada.",
        "Confirmar saída",
      )
    ) {
      await logout();
      navigate("login");
    }
    return;
  }
  if (action === "open-course") {
    if (!user()) {
      navigate("login");
      return;
    }
    if (user().role === "Student")
      await api(`/courses/${id}/enrollments`, { method: "POST" });
    navigate(`curso/${id}`);
    return;
  }
  if (action === "read-lesson" || action === "continue-course") {
    if (!id) {
      toast("Você concluiu todas as atividades disponíveis!");
      return;
    }
    const details = document.querySelector(`#lesson-${id}`);
    if (details) {
      details.open = true;
      details.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
    }
    return;
  }
  if (action === "complete") {
    const l = lessonData.find((l) => l.id === id);
    const result = await api("/sync", {
      method: "POST",
      body: {
        operations: [
          {
            operationId: crypto.randomUUID(),
            lessonId: id,
            learningCycle: l.learningCycle,
          },
        ],
      },
    });
    if (!result.results[0].success) throw new Error(result.results[0].error);
    toast("Atividade concluída! A próxima atividade já pode ser acessada.");
    await render();
    return;
  }
  if (action === "restart-course") {
    if (
      await confirmAction(
        "Reiniciar disciplina?",
        "Um novo ciclo de estudo será iniciado. As conclusões anteriores, notas e certificados serão preservados.",
        "Reiniciar",
      )
    ) {
      await api(`/courses/${id}/restart`, { method: "POST" });
      await render();
      toast("Novo ciclo de estudo iniciado.");
    }
    return;
  }
  if (action.startsWith("quiz-")) {
    if (action === "quiz-prev") quiz.index = Math.max(0, quiz.index - 1);
    if (action === "quiz-next")
      quiz.index = Math.min(quiz.data.questions.length - 1, quiz.index + 1);
    if (action === "quiz-goto") quiz.index = Number(id);
    showQuizQuestion();
    return;
  }
  if (action === "edit-course") {
    const courses = await api(`/courses?page=${coursePage}`);
    document.querySelector("#course-editor").innerHTML = courseForm(
      courses.find((c) => c.id === id),
    );
    document.querySelector("#course-form input").focus();
    return;
  }
  if (action === "cancel-edit") {
    document.querySelector("#course-editor").innerHTML = courseForm();
    return;
  }
  if (action === "archive-lesson") {
    if (
      await confirmAction(
        "Excluir atividade?",
        "A atividade será arquivada e deixará de aparecer para alunos. Seu histórico será preservado.",
        "Excluir atividade",
      )
    ) {
      await api(`/lessons/${id}`, { method: "DELETE" });
      await render();
      toast("Atividade arquivada.");
    }
    return;
  }
  if (action === "save-user") {
    const row = target.closest("tr");
    await api(`/users/${id}/access`, {
      method: "PUT",
      body: {
        role: row.querySelector("select").value,
        active: row.querySelector("input").checked,
      },
    });
    toast("Permissões atualizadas.");
    return;
  }
  if (action === "print-certificate") {
    window.print();
    return;
  }
  if (action === "csv") {
    downloadCsv();
    return;
  }
  if (action === "calendar-prev" || action === "calendar-next") {
    calendarMonth.setMonth(
      calendarMonth.getMonth() + (action.endsWith("next") ? 1 : -1),
    );
    await render();
    return;
  }
  for (const kind of ["courses", "users", "reports", "academic", "assignments"])
    if (action === `${kind}-next` || action === `${kind}-prev`) {
      const delta = action.endsWith("next") ? 1 : -1;
      if (kind === "courses") coursePage += delta;
      if (kind === "users") userPage += delta;
      if (kind === "reports") reportPage += delta;
      if (kind === "academic") academicPage += delta;
      if (kind === "assignments") assignmentPage += delta;
      await render();
      return;
    }
}
document.addEventListener("click", async (event) => {
  const link = event.target.closest("#drawer a");
  if (link) closeDrawer();
  const target = event.target.closest("[data-action]");
  if (!target) return;
  target.disabled = true;
  try {
    await handleAction(target);
  } catch (error) {
    toast(error.message);
  } finally {
    target.disabled = false;
  }
});
root.addEventListener("input", (event) => {
  if (event.target.matches("[data-mask]")) applyMask(event.target);
});
root.addEventListener("change", (event) => {
  const input = event.target;
  if (input.matches("#auth-form [name=context]")) {
    const cargo = document.querySelector("#cargo-field");
    cargo.hidden = input.value !== "Staff";
    if (cargo.hidden) cargo.querySelector("select").value = "";
    return;
  }
  if (!input.matches("[data-quiz-question]") || !quiz?.session || quiz.busy)
    return;
  const currentQuiz = quiz;
  currentQuiz.answers.set(input.dataset.quizQuestion, input.value);
  showQuizQuestion();
  const answer = {
    questionId: input.dataset.quizQuestion,
    optionId: input.value,
  };
  document.querySelector("#quiz-save-status").textContent =
    "Salvando resposta…";
  currentQuiz.saving = currentQuiz.saving
    .then(() =>
      api(`/assessment-sessions/${currentQuiz.session.id}/answers`, {
        method: "PUT",
        body: { answers: [answer] },
      }),
    )
    .then(() => {
      if (quiz === currentQuiz && document.querySelector("#quiz-save-status"))
        document.querySelector("#quiz-save-status").textContent =
          "Resposta salva.";
    })
    .catch((error) => {
      toast(`Resposta não confirmada: ${error.message}`);
    });
});
root.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const v = Object.fromEntries(data);
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    if (form.id === "auth-form") {
      if (authMode === "register" && v.password !== v.confirmPassword)
        throw new Error("As senhas não coincidem.");
      const body =
        authMode === "register"
          ? {
              name: v.name,
              email: v.email,
              password: v.password,
              profile: profilePayload(v),
            }
          : { email: v.email, password: v.password };
      const session = await authenticate(authMode, body);
      if (
        authMode === "login" &&
        ((v.context === "Student" && session.user.role !== "Student") ||
          (v.context === "Staff" && session.user.role === "Student"))
      ) {
        await logout();
        throw new Error(
          "Selecione o tipo de acesso correspondente à sua conta.",
        );
      }
      if (authMode === "login" && v.cargo && session.user.role !== v.cargo) {
        await logout();
        throw new Error("O cargo selecionado não corresponde à sua conta.");
      }
      navigate("inicio");
      if (authMode === "register")
        api("/me/profile")
          .then((created) =>
            toast(
              `Cadastro realizado! Matrícula: ${created.registrationNumber} ✅`,
            ),
          )
          .catch(() => toast("Cadastro realizado! ✅"));
      else
        toast(`Bem-vindo(a), ${session.user.name.split(" ")[0]}! ✅`);
    } else if (form.id === "attempt-form") await finishQuiz();
    else if (form.id === "profile-form") {
      await api("/me/profile", { method: "PUT", body: profilePayload(v) });
      getSession().user.name = v.name;
      toast("Dados pessoais atualizados.");
      await render();
    } else if (form.id === "course-form") {
      await api(`/courses${form.dataset.id ? "/" + form.dataset.id : ""}`, {
        method: form.dataset.id ? "PUT" : "POST",
        body: {
          title: v.title,
          description: v.description,
          published: data.has("published"),
          sequential: data.has("sequential"),
          workloadHours: Number(v.workloadHours),
        },
      });
      toast("Disciplina salva.");
      await render();
    } else if (
      form.id === "lesson-form" ||
      form.matches(".add-module-lesson")
    ) {
      const course = form.dataset.course || v.courseId;
      await api(`/courses/${course}/lessons`, {
        method: "POST",
        body: {
          moduleId: form.dataset.module || null,
          moduleTitle: form.dataset.moduleTitle || v.moduleTitle,
          title: v.title,
          content: v.content,
          position: Number(v.position || 1),
          availableFrom: v.availableFrom
            ? new Date(v.availableFrom).toISOString()
            : null,
        },
      });
      toast("Atividade adicionada.");
      await render();
    } else if (form.matches(".edit-lesson-form")) {
      const l = managedLessons.find((l) => l.id === form.dataset.id);
      await api(`/lessons/${l.id}`, {
        method: "PUT",
        body: {
          moduleId: l.moduleId,
          moduleTitle: l.moduleTitle,
          title: v.title,
          content: v.content,
          position: Number(v.position),
        },
      });
      toast("Atividade salva.");
      await render();
    } else if (form.matches(".module-form")) {
      await api(`/modules/${form.dataset.id}`, {
        method: "PUT",
        body: {
          title: v.title,
          position: Number(v.position),
          availableFrom: v.availableFrom
            ? new Date(v.availableFrom).toISOString()
            : null,
        },
      });
      toast("Unidade salva.");
      await render();
    } else if (form.id === "assessment-form") {
      const questions = [...form.querySelectorAll("[data-question]")].map(
        (_, i) => ({
          prompt: v[`prompt-${i}`],
          options: [0, 1, 2, 3, 4].map((j) => ({
            text: v[`option-${i}-${j}`],
            correct: String(j) === v[`correct-${i}`],
          })),
        }),
      );
      await api(`/courses/${v.courseId}/assessments`, {
        method: "POST",
        body: {
          title: v.title,
          questions,
          timeLimitMinutes: Number(v.timeLimitMinutes),
        },
      });
      toast("Avaliação publicada.");
      await render();
    } else if (form.matches(".grade-form")) {
      await api(
        `/academic/users/${form.dataset.user}/courses/${form.dataset.course}/records`,
        {
          method: "POST",
          body: {
            grade: Number(v.grade),
            attendance: v.attendance === "" ? null : Number(v.attendance),
            reason: v.reason,
          },
        },
      );
      toast("Nota e frequência registradas com auditoria.");
      await render();
    } else if (form.id === "assignment-form") {
      await api(`/teachers/${form.dataset.id}/courses`, {
        method: "PUT",
        body: {
          courseIds: [
            ...JSON.parse(form.dataset.existing),
            ...data.getAll("courses"),
          ],
        },
      });
      toast("Disciplinas atribuídas.");
    } else if (form.id === "notice-form") {
      await api("/announcements", {
        method: "POST",
        body: { title: v.title, content: v.content },
      });
      toast("Aviso publicado.");
      await render();
    } else if (form.id === "calendar-form") {
      await api("/calendar", {
        method: "POST",
        body: {
          title: v.title,
          description: v.description,
          startsAt: new Date(v.startsAt).toISOString(),
          endsAt: new Date(v.endsAt).toISOString(),
        },
      });
      toast("Evento salvo.");
      await render();
    }
  } catch (error) {
    if (form.id === "auth-form") {
      const output = document.querySelector("#auth-error");
      output.hidden = false;
      output.textContent = error.message;
    } else toast(error.message);
  } finally {
    submit.disabled = false;
  }
});
document.querySelector("#confirmation").addEventListener("close", (event) => {
  confirmResolve?.(event.target.returnValue === "confirm");
  confirmResolve = null;
});
window.addEventListener("hashchange", render);
window.addEventListener("session-expired", () => {
  toast("Sua sessão expirou. Entre novamente.");
  navigate("login");
});
setInterval(clock, 30000);
try {
  await restore();
} catch {
  /* O catálogo está disponível aos visitantes. */
}
await render();
