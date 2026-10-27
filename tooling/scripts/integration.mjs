import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startEnvironment, command } from "./test-environment.mjs";
import { checkRestoredFeatures } from "./legacy-checks.mjs";
const environment = await startEnvironment();
const { base, client, adminEmail, adminPassword } = environment;
let checks = 0;
async function request(
  path,
  { method = "GET", body, token, expected = 200, headers = {} } = {},
) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-EducaTech-Client": "native",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const content = await response.text();
  const data = content ? JSON.parse(content) : null;
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}\n${environment.logs()}`,
  );
  checks++;
  return { data, response };
}
const course = "10000000-0000-0000-0000-000000000001";
const lesson = "30000000-0000-0000-0000-000000000001";
const assessment = "40000000-0000-0000-0000-000000000001";
const password = "Aluno!TesteSeguro2026";
try {
  assert.equal((await fetch(`${base}/`)).status, 200);
  checks++;
  assert.equal((await fetch(`${base}/swagger/v1/swagger.json`)).status, 200);
  checks++;
  await request("/me/enrollments", { expected: 401 });
  await request("/auth/register", {
    method: "POST",
    body: { name: "Fraude", email: "fraude@test.com", password, role: "Admin" },
    expected: 400,
  });
  const admin = (
    await request("/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    })
  ).data;
  const student = (
    await request("/auth/register", {
      method: "POST",
      body: {
        name: "Aluno Integração",
        email: "aluno@educatech.test",
        password,
      },
      expected: 201,
    })
  ).data;
  assert.equal(student.user.role, "Student");
  checks++;
  const second = (
    await request("/auth/register", {
      method: "POST",
      body: {
        name: "Segundo Aluno",
        email: "segundo@educatech.test",
        password,
      },
      expected: 201,
    })
  ).data;
  await request("/auth/login", {
    method: "POST",
    body: { email: "aluno@educatech.test", password: "errada" },
    expected: 401,
  });
  await request("/users", { token: student.accessToken, expected: 403 });
  await request("/reports/courses", {
    token: student.accessToken,
    expected: 403,
  });
  await request("/courses", {
    method: "POST",
    token: student.accessToken,
    body: { title: "Fraude", description: "Teste", published: true },
    expected: 403,
  });
  await request(`/courses/${course}/lessons`, {
    token: student.accessToken,
    expected: 403,
  });
  await request(`/courses/${course}/enrollments`, {
    method: "POST",
    token: student.accessToken,
    expected: 204,
  });
  await request(`/courses/${course}/enrollments`, {
    method: "POST",
    token: student.accessToken,
    expected: 204,
  });
  const ls = (
    await request(`/courses/${course}/lessons`, { token: student.accessToken })
  ).data;
  assert.equal(ls.length, 2);
  checks++;
  const operation = { operationId: randomUUID(), lessonId: lesson };
  const syncs = await Promise.all([
    request("/sync", {
      method: "POST",
      token: student.accessToken,
      body: { operations: [operation] },
    }),
    request("/sync", {
      method: "POST",
      token: student.accessToken,
      body: { operations: [operation] },
    }),
  ]);
  assert.ok(syncs.every((r) => r.data.results[0].success));
  checks++;
  assert.equal(syncs[1].data.enrollments[0].progress, 50);
  checks++;
  assert.equal(
    Number(
      (await client.query("SELECT count(*) FROM saai.lesson_progress")).rows[0]
        .count,
    ),
    1,
  );
  checks++;
  const conflict = (
    await request("/sync", {
      method: "POST",
      token: student.accessToken,
      body: { operations: [{ ...operation, lessonId: ls[1].id }] },
    })
  ).data;
  assert.equal(conflict.results[0].success, false);
  checks++;
  const alien = (
    await request("/sync", {
      method: "POST",
      token: second.accessToken,
      body: { operations: [{ operationId: randomUUID(), lessonId: lesson }] },
    })
  ).data;
  assert.equal(alien.results[0].success, false);
  checks++;
  const quiz = (
    await request(`/assessments/${assessment}`, { token: student.accessToken })
  ).data;
  assert.ok(!JSON.stringify(quiz).includes("isCorrect"));
  checks++;
  assert.ok(!JSON.stringify(quiz).includes("correct"));
  checks++;
  const answers = [
    {
      questionId: "50000000-0000-0000-0000-000000000001",
      optionId: "60000000-0000-0000-0000-000000000002",
    },
    {
      questionId: "50000000-0000-0000-0000-000000000002",
      optionId: "60000000-0000-0000-0000-000000000003",
    },
  ];
  await request(`/assessments/${assessment}/attempts`, {
    method: "POST",
    token: student.accessToken,
    body: {
      operationId: randomUUID(),
      answers: [
        { questionId: answers[0].questionId, optionId: answers[1].optionId },
        answers[1],
      ],
    },
    expected: 409,
  });
  await request(`/assessments/${assessment}/attempts`, {
    method: "POST",
    token: second.accessToken,
    body: { operationId: randomUUID(), answers },
    expected: 409,
  });
  const submission = { operationId: randomUUID(), answers };
  const attempt = (
    await request(`/assessments/${assessment}/attempts`, {
      method: "POST",
      token: student.accessToken,
      body: submission,
    })
  ).data;
  assert.equal(attempt.score, 100);
  checks++;
  assert.equal(attempt.passed, true);
  checks++;
  await request(`/assessments/${assessment}/attempts`, {
    method: "POST",
    token: student.accessToken,
    body: { operationId: randomUUID(), answers: [null] },
    expected: 400,
  });
  await request("/sync", {
    method: "POST",
    token: student.accessToken,
    body: { operations: [null] },
    expected: 400,
  });
  const repeated = (
    await request(`/assessments/${assessment}/attempts`, {
      method: "POST",
      token: student.accessToken,
      body: submission,
    })
  ).data;
  assert.equal(attempt.id, repeated.id);
  checks++;
  await request(`/assessments/${assessment}/attempts`, {
    method: "POST",
    token: student.accessToken,
    body: { ...submission, answers: answers.slice(0, 1) },
    expected: 409,
  });
  assert.deepEqual(
    (await request("/me/attempts", { token: second.accessToken })).data,
    [],
  );
  checks++;
  const report = (
    await request("/reports/courses", { token: admin.accessToken })
  ).data.find((r) => r.courseId === course);
  assert.equal(report.students, 1);
  assert.equal(report.averageProgress, 50);
  assert.equal(report.averageScore, 100);
  checks += 3;
  const audit = (
    await client.query(
      "SELECT * FROM saai.audit_log WHERE table_name='lesson_progress'",
    )
  ).rows;
  assert.equal(audit[0].actor_id, student.user.id);
  checks++;
  assert.ok(
    !(
      await client.query(
        "SELECT new_data::text FROM saai.audit_log WHERE table_name='users'",
      )
    ).rows.some((r) => r.new_data.includes("password_hash")),
  );
  checks++;
  await assert.rejects(
    client.query("DELETE FROM saai.attempts WHERE id=$1", [attempt.id]),
    /imutável/,
  );
  checks++;
  await request(`/users/${second.user.id}/access`, {
    method: "PUT",
    token: admin.accessToken,
    body: { role: "Teacher", active: true },
    expected: 204,
  });
  await request("/auth/me", { token: second.accessToken, expected: 401 });
  const teacher = (
    await request("/auth/login", {
      method: "POST",
      body: { email: "segundo@educatech.test", password },
    })
  ).data;
  await request("/users", { token: teacher.accessToken, expected: 403 });
  await request(`/courses/${course}/assessments`, {
    method: "POST",
    token: teacher.accessToken,
    body: { title: "Inválida", questions: [null] },
    expected: 400,
  });
  await request(`/courses/${course}/assessments`, {
    method: "POST",
    token: teacher.accessToken,
    body: {
      title: "Inválida",
      questions: [
        { prompt: "Teste", options: [null, { text: "A", correct: true }] },
      ],
    },
    expected: 400,
  });
  const newCourse = (
    await request("/courses", {
      method: "POST",
      token: teacher.accessToken,
      body: {
        title: "Curso criado pela API",
        description: "Conteúdo de integração",
        published: false,
      },
      expected: 201,
    })
  ).data;
  assert.ok(
    !(await request("/courses")).data.some((c) => c.id === newCourse.id),
  );
  checks++;
  await request(`/courses/${newCourse.id}/lessons`, {
    method: "POST",
    token: teacher.accessToken,
    body: {
      moduleId: null,
      moduleTitle: "Módulo",
      title: "Aula",
      content: "Conteúdo",
      position: 1,
    },
    expected: 201,
  });
  await request(`/courses/${newCourse.id}/assessments`, {
    method: "POST",
    token: teacher.accessToken,
    body: {
      title: "Teste",
      questions: [
        {
          prompt: "Escolha",
          options: [
            { text: "A", correct: true },
            { text: "B", correct: false },
          ],
        },
      ],
    },
    expected: 201,
  });
  const refreshed = (
    await request("/auth/refresh", {
      method: "POST",
      body: { refreshToken: student.refreshToken },
    })
  ).data;
  await request("/auth/refresh", {
    method: "POST",
    body: { refreshToken: student.refreshToken },
    expected: 401,
  });
  await request("/auth/refresh", {
    method: "POST",
    body: { refreshToken: refreshed.refreshToken },
    expected: 401,
  });
  const web = await request("/auth/login", {
    method: "POST",
    body: { email: "aluno@educatech.test", password },
    headers: { "X-EducaTech-Client": "web" },
  });
  assert.equal(web.data.refreshToken, null);
  checks++;
  assert.match(web.response.headers.get("set-cookie"), /httponly/i);
  checks++;
  assert.match(web.response.headers.get("set-cookie"), /samesite=strict/i);
  checks++;
  await request("/auth/refresh", {
    method: "POST",
    body: {},
    headers: {
      "X-EducaTech-Client": "web",
      Origin: "https://malicious.example",
    },
    expected: 403,
  });
  await request(`/users/${student.user.id}/access`, {
    method: "PUT",
    token: admin.accessToken,
    body: { role: "Student", active: false },
    expected: 204,
  });
  await request("/auth/me", { token: web.data.accessToken, expected: 401 });
  checks += await checkRestoredFeatures({
    request,
    client,
    admin,
    teacher,
    password,
    course,
  });
  if (process.argv.includes("--web")) {
    // Cenários independentes conservam os limites reais de produção. O banco permanece intacto.
    await environment.restartApi();
    await command(
      process.execPath,
      [
        "tooling/node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "tooling/config/playwright.config.mjs",
      ],
      {
        env: {
          ...process.env,
          TEST_BASE_URL: base,
          TEST_ADMIN_EMAIL: adminEmail,
          TEST_ADMIN_PASSWORD: adminPassword,
        },
      },
    );
  }
  console.log(
    `VALIDAÇÃO: ${checks} verificações de API, SQL, segurança e concorrência aprovadas.`,
  );
} finally {
  await environment.cleanup();
}
