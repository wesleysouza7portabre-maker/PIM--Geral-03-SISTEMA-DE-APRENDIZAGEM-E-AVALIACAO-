import { api } from "./api.js";

export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const roles = {
  Student: "Aluno",
  Teacher: "Professor",
  Coordinator: "Coordenador",
  Admin: "Administrador",
};
export const field = (label, name, type = "text", value = "", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
export const button = (text, action, id = "", secondary = false) =>
  `<button type="button" class="btn ${secondary ? "secondary" : ""}" data-action="${action}" data-id="${escape(id)}">${text}</button>`;
export const head = (eyebrow, title, description, actions = "") =>
  `<header class="page-head"><div><p class="eyebrow">${escape(eyebrow)}</p><h1>${escape(title)}</h1><p class="muted">${escape(description)}</p></div><div class="actions">${actions}</div></header>`;
export const pager = (page, count, type) =>
  `<div class="pager">${page > 1 ? button("Anterior", `${type}-prev`, "", true) : ""}<span>Página ${page}</span>${count === 50 ? button("Próxima", `${type}-next`, "", true) : ""}</div>`;
const ufs =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
// Máscaras do protótipo original: CPF 000.000.000-00, telefone (00) 00000-0000 e CEP 00000-000.
const masks = {
  cpf: (d) =>
    d.length > 9
      ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
      : d.length > 6
        ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
        : d.length > 3
          ? `${d.slice(0, 3)}.${d.slice(3)}`
          : d,
  phone: (d) =>
    d.length > 10
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
      : d.length > 6
        ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
        : d.length > 2
          ? `(${d.slice(0, 2)}) ${d.slice(2)}`
          : d,
  cep: (d) => (d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5, 8)}` : d),
};
export const applyMask = (input) =>
  (input.value = masks[input.dataset.mask](input.value.replace(/\D/g, "")));
export const profileFields = (p) =>
  `<div class="form-row">${field("CPF (opcional)", "cpf", "text", p?.cpf ? masks.cpf(p.cpf) : "", 'inputmode="numeric" maxlength="14" placeholder="000.000.000-00" data-mask="cpf"')}${field("Telefone (opcional)", "phone", "tel", p?.phone || "", 'maxlength="24" placeholder="(00) 00000-0000" autocomplete="tel" data-mask="phone"')}${field("Endereço (opcional)", "address", "text", p?.address || "", 'maxlength="240" autocomplete="street-address"')}${field("Cidade (opcional)", "city", "text", p?.city || "", 'maxlength="120" autocomplete="address-level2"')}<label class="field">Estado — UF (opcional)<select name="state" autocomplete="address-level1"><option value="">UF</option>${ufs.map((uf) => `<option ${p?.state === uf ? "selected" : ""}>${uf}</option>`).join("")}</select></label>${field("CEP (opcional)", "postalCode", "text", p?.postalCode ? masks.cep(p.postalCode) : "", 'inputmode="numeric" maxlength="9" placeholder="00000-000" autocomplete="postal-code" data-mask="cep"')}</div>`;
export const profilePayload = (values) => ({
  name: values.name,
  cpf: values.cpf?.replace(/\D/g, "") || null,
  phone: values.phone || null,
  address: values.address || null,
  city: values.city || null,
  state: values.state || null,
  postalCode: values.postalCode?.replace(/\D/g, "") || null,
});

export function courseForm(c) {
  return `<form id="course-form" class="form" data-id="${c?.id || ""}"><h2>${c ? "Editar disciplina" : "Nova disciplina"}</h2>${field("Título", "title", "text", c?.title || "", 'required maxlength="160"')}<label class="field">Descrição<textarea name="description" required maxlength="4000">${escape(c?.description || "")}</textarea></label>${field("Carga horária prevista (horas)", "workloadHours", "number", c?.workloadHours || 2, 'required min="1" max="10000"')}<label class="check"><input name="published" type="checkbox" ${c?.published ? "checked" : ""}>Publicar no catálogo</label><label class="check"><input name="sequential" type="checkbox" ${c?.sequential ? "checked" : ""}>Desbloquear atividades em sequência</label><div class="actions"><button class="btn" type="submit">Salvar disciplina</button>${c ? button("Cancelar edição", "cancel-edit", "", true) : ""}</div></form>`;
}
function questionEditor(index) {
  return `<fieldset class="question-editor" data-question><legend>Questão ${index + 1}</legend>${field("Enunciado", `prompt-${index}`, "text", "", 'required maxlength="4000"')}<div class="form-row">${[0, 1, 2, 3, 4].map((i) => field(`Alternativa ${String.fromCharCode(65 + i)}`, `option-${index}-${i}`, "text", "", 'required maxlength="2000"')).join("")}<label class="field">Alternativa correta<select name="correct-${index}">${[0, 1, 2, 3, 4].map((i) => `<option value="${i}">${String.fromCharCode(65 + i)}</option>`).join("")}</select></label></div></fieldset>`;
}
export function addQuestion() {
  const list = document.querySelector("#question-editors");
  if (list.children.length >= 50) throw new Error("Limite de 50 questões.");
  list.insertAdjacentHTML("beforeend", questionEditor(list.children.length));
}
export async function administration(page) {
  const courses = await api(`/courses?page=${page}`);
  const manageable = courses.filter((c) => c.canManage);
  const options = manageable
    .map((c) => `<option value="${c.id}">${escape(c.title)}</option>`)
    .join("");
  return `${head("ESPAÇO DA INSTITUIÇÃO", "Gestão de conteúdo", "Gerencie suas disciplinas, unidades, atividades e avaliações.")}<div class="split"><section class="stack"><div class="card table-wrap"><table><caption>Disciplinas cadastradas</caption><thead><tr><th>Disciplina</th><th>Status</th><th>Ações</th></tr></thead><tbody>${manageable.map((c) => `<tr><td>${escape(c.title)}</td><td>${c.published ? "Publicada" : "Rascunho"}</td><td><div class="actions">${button("Editar", "edit-course", c.id, true)}<a class="btn secondary" href="#gerenciar/${c.id}">Gerenciar atividades</a></div></td></tr>`).join("") || '<tr><td colspan="3">Nenhuma disciplina atribuída. Consulte a coordenação ou crie uma nova disciplina.</td></tr>'}</tbody></table>${pager(page, courses.length, "courses")}</div><section class="card"><form id="lesson-form" class="form"><h2>Adicionar atividade</h2><label class="field">Disciplina<select name="courseId" required>${options}</select></label>${field("Nome da unidade", "moduleTitle", "text", "", 'required maxlength="160"')}${field("Título da atividade", "title", "text", "", 'required maxlength="160"')}<label class="field">Conteúdo em texto<textarea name="content" required maxlength="40000"></textarea></label>${field("Liberar unidade a partir de (opcional)", "availableFrom", "datetime-local")}<button class="btn" type="submit" ${!manageable.length ? "disabled" : ""}>Salvar atividade</button></form></section></section><aside class="card" id="course-editor">${courseForm()}</aside></div><section class="card content-block"><form id="assessment-form" class="form"><h2>Nova avaliação</h2><div class="form-row"><label class="field">Disciplina<select name="courseId" required>${options}</select></label>${field("Título da avaliação", "title", "text", "", 'required maxlength="160"')}${field("Duração (minutos)", "timeLimitMinutes", "number", 30, 'min="1" max="180" required')}</div><p class="muted">Indique uma alternativa correta em cada questão. A correção acontece no servidor.</p><div id="question-editors" class="stack">${questionEditor(0)}</div><div class="actions">${button("Adicionar questão", "add-question", "", true)}<button class="btn" type="submit" ${!manageable.length ? "disabled" : ""}>Publicar avaliação</button></div></form></section>`;
}
export let managedLessons = [];
export async function manageActivities(id) {
  managedLessons = await api(`/courses/${id}/lessons`);
  const modules = Map.groupBy(managedLessons, (l) => l.moduleId);
  return `${head("GERENCIAR DISCIPLINA", "Atividades por unidade", "Alterações são persistidas. Excluir arquiva a atividade e mantém seu histórico.")}<div class="stack">${[...modules.values()].map((ls) => `<section class="card"><form class="module-form form" data-id="${ls[0].moduleId}"><h2>Unidade ${ls[0].modulePosition}</h2><div class="form-row">${field("Título da unidade", "title", "text", ls[0].moduleTitle, 'required maxlength="160"')}${field("Posição da unidade", "position", "number", ls[0].modulePosition, 'required min="1" max="10000"')}${field("Liberação da unidade (opcional)", "availableFrom", "datetime-local", ls[0].availableFrom ? localDateTime(ls[0].availableFrom) : "")}</div><button class="btn secondary" type="submit">Salvar unidade</button></form><div class="stack content-block">${ls.map((l) => `<form class="edit-lesson-form form" data-id="${l.id}"><div class="form-row">${field("Nome da atividade", "title", "text", l.title, 'required maxlength="160"')}${field("Posição", "position", "number", l.position, 'required min="1" max="10000"')}</div><label class="field">Conteúdo<textarea name="content" required maxlength="40000">${escape(l.content)}</textarea></label><div class="actions"><button class="btn" type="submit">Salvar atividade</button>${button("Excluir atividade", "archive-lesson", l.id, true)}</div></form>`).join("")}</div><form class="add-module-lesson form content-block" data-course="${id}" data-module="${ls[0].moduleId}" data-module-title="${escape(ls[0].moduleTitle)}"><h3>Adicionar atividade à unidade</h3>${field("Nome da nova atividade", "title", "text", "", 'required maxlength="160"')}<label class="field">Conteúdo<textarea name="content" required maxlength="40000"></textarea></label><input type="hidden" name="position" value="${Math.max(...ls.map((l) => l.position)) + 1}"><button class="btn secondary" type="submit">Adicionar atividade</button></form></section>`).join("") || '<p class="card">Adicione a primeira atividade na Gestão de conteúdo.</p>'}</div>`;
}
export function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export async function academicUsers(page, role) {
  const rows = await api(`/academic/users?page=${page}`);
  return `${head("ACOMPANHAMENTO ACADÊMICO", role === "Teacher"
      ? "Lista de alunos"
      : role === "Admin"
        ? "Usuários do sistema"
        : "Professores e alunos", "Consulte o desempenho e registre ajustes com justificativa.")}<div class="card table-wrap"><table><caption>Usuários permitidos pelo seu perfil</caption><thead><tr><th>Matrícula</th><th>Nome</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>${rows.map((u) => `<tr><td>${escape(u.registrationNumber)}</td><td>${escape(u.name)}</td><td><span class="badge">${roles[u.role]}</span></td><td>${u.role === "Student" ? `<a class="btn secondary" href="#aluno/${u.id}">Ver / Notas</a>` : u.role === "Teacher" && role !== "Teacher" ? `<a class="btn secondary" href="#professor/${u.id}">Atribuir disciplinas</a>` : "—"}</td></tr>`).join("")}</tbody></table>${pager(page, rows.length, "academic")}</div>`;
}
export async function studentRecord(id) {
  const rows = await api(`/academic/users/${id}/performance`);
  return `${head("ACOMPANHAMENTO INDIVIDUAL", "Notas e frequência", "Uma nova anotação não altera a tentativa original nem apaga lançamentos anteriores.")}<div class="stack">${rows.map((r) => `<article class="card"><h2>${escape(r.courseTitle)}</h2><p>Progresso: ${r.progress}% · ${r.completedLessons}/${r.totalLessons} atividades</p><form class="grade-form form" data-user="${id}" data-course="${r.courseId}"><div class="form-row">${field("Nota (0 a 10)", "grade", "number", r.grade ?? "", 'required min="0" max="10" step="0.1"')}${field("Frequência (0 a 100%, opcional)", "attendance", "number", r.attendance ?? "", 'min="0" max="100" step="0.1"')}</div><label class="field">Justificativa<textarea name="reason" required minlength="5" maxlength="500"></textarea></label><button type="submit" class="btn">Salvar notas e frequência</button></form></article>`).join("")}</div>`;
}
export async function teacherAssignments(id, page = 1) {
  // A atribuição é feita por página do catálogo, preservando IDs de outras páginas.
  const [courses, assigned] = await Promise.all([
    api(`/courses?page=${page}`),
    api(`/teachers/${id}/courses`),
  ]);
  return `${head("COORDENAÇÃO", "Atribuir disciplinas", "O professor só pode administrar as disciplinas atribuídas ou criadas por ele.")}<form class="card form" id="assignment-form" data-id="${id}" data-existing="${escape(JSON.stringify(assigned.filter((course) => !courses.some((c) => c.id === course))))}">${courses.map((c) => `<label class="check"><input type="checkbox" name="courses" value="${c.id}" ${assigned.includes(c.id) ? "checked" : ""}>${escape(c.title)}</label>`).join("")}<p class="muted">Salve as alterações antes de mudar de página.</p><button class="btn" type="submit">Salvar atribuições</button></form>${pager(page, courses.length, "assignments")}`;
}
