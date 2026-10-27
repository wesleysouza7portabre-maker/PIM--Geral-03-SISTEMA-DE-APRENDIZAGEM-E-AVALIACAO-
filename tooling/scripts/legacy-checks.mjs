import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkRestoredFeatures({
  request,
  client,
  admin,
  teacher,
  password,
  course,
}) {
  let checks = 0;
  const check = (actual, expected) => {
    assert.deepEqual(actual, expected);
    checks++;
  };
  const learner = (
    await request("/auth/register", {
      method: "POST",
      body: {
        name: "Aluno Restaurado",
        email: "restaurado@educatech.test",
        password,
        profile: {
          name: "Aluno Restaurado",
          cpf: "52998224725",
          phone: "11999999999",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001000",
        },
      },
      expected: 201,
    })
  ).data;
  const token = learner.accessToken;
  const profile = (await request("/me/profile", { token })).data;
  check(profile.cpf, "52998224725");
  check(profile.registrationNumber.startsWith("SAAI-"), true);
  await request("/auth/register", {
    method: "POST",
    body: {
      name: "Duplicado",
      email: "cpf-duplicado@educatech.test",
      password,
      profile: { name: "Duplicado", cpf: "52998224725" },
    },
    expected: 409,
  });
  check(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM saai.users WHERE email='cpf-duplicado@educatech.test'",
        )
      ).rows[0].count,
    ),
    0,
  );
  await request("/me/profile", {
    method: "PUT",
    token,
    body: { name: "Aluno Restaurado", cpf: "11111111111" },
    expected: 400,
  });
  await request("/me/profile", {
    method: "PUT",
    token,
    body: { ...profilePayload(profile), city: "Campinas" },
    expected: 204,
  });
  check((await request("/me/profile", { token })).data.city, "Campinas");
  await request(`/courses/${course}/enrollments`, {
    method: "POST",
    token,
    expected: 204,
  });
  const lessons = (await request(`/courses/${course}/lessons`, { token })).data;
  const originalSecond = (
    await client.query("SELECT title,content FROM saai.lessons WHERE id=$1", [
      lessons[1].id,
    ])
  ).rows[0];
  check(lessons[1].available, false);
  check(lessons[1].content, "");
  const originalQuiz = "40000000-0000-0000-0000-000000000002";
  await request(`/assessments/${originalQuiz}`, { token, expected: 403 });
  await request(`/assessments/${originalQuiz}/sessions`, {
    method: "POST",
    token,
    expected: 409,
  });
  await request(`/courses/${course}/lessons`, {
    method: "POST",
    token: teacher.accessToken,
    body: {
      moduleId: null,
      moduleTitle: "Teste",
      title: "Não permitido",
      content: "Bloqueado",
      position: 1,
    },
    expected: 403,
  });
  check(
    (
      await request("/academic/users", { token: teacher.accessToken })
    ).data.some((u) => u.id === learner.user.id),
    false,
  );
  await request(`/teachers/${teacher.user.id}/courses`, {
    method: "PUT",
    token: admin.accessToken,
    body: { courseIds: [course] },
    expected: 204,
  });
  check(
    (
      await request("/academic/users", { token: teacher.accessToken })
    ).data.some((u) => u.id === learner.user.id),
    true,
  );
  const reportFixtures = (
    await client.query(
      "INSERT INTO saai.courses(title,description,published) SELECT 'AAA Teste '||n,'Curso temporário para testar paginação',true FROM generate_series(1,51) n RETURNING id",
    )
  ).rows.map((r) => r.id);
  try {
    check(
      (
        await request("/reports/courses", { token: teacher.accessToken })
      ).data.some((r) => r.courseId === course),
      true,
    );
  } finally {
    await client.query("DELETE FROM saai.courses WHERE id=ANY($1::uuid[])", [
      reportFixtures,
    ]);
  }
  await request(`/teachers/${teacher.user.id}/courses`, {
    method: "PUT",
    token: teacher.accessToken,
    body: { courseIds: [] },
    expected: 403,
  });
  const first = {
    operationId: randomUUID(),
    lessonId: lessons[0].id,
    learningCycle: 1,
  };
  const outOfOrder = (
    await request("/sync", {
      method: "POST",
      token,
      body: {
        operations: [
          {
            operationId: randomUUID(),
            lessonId: lessons[1].id,
            learningCycle: 1,
          },
        ],
      },
    })
  ).data;
  check(outOfOrder.results[0].success, false);
  await request("/sync", {
    method: "POST",
    token,
    body: { operations: [first] },
  });
  check(
    (await request(`/courses/${course}/lessons`, { token })).data[1].available,
    true,
  );
  await request("/sync", {
    method: "POST",
    token,
    body: {
      operations: [
        {
          operationId: randomUUID(),
          lessonId: lessons[1].id,
          learningCycle: 1,
        },
      ],
    },
  });
  const restoredQuiz = (
    await request(`/assessments/${originalQuiz}`, { token })
  ).data;
  check(restoredQuiz.questions.length, 5);
  check(restoredQuiz.timeLimitMinutes, 30);
  check(
    restoredQuiz.questions.some(
      (q) => q.imagePath === "/assets/quiz-q3-diagrama.jpg",
    ),
    true,
  );
  await request(
    `/academic/users/${learner.user.id}/courses/${course}/records`,
    {
      method: "POST",
      token,
      body: { grade: 9, attendance: 95, reason: "Não pode" },
      expected: 403,
    },
  );
  await request(
    `/academic/users/${learner.user.id}/courses/${course}/records`,
    {
      method: "POST",
      token: teacher.accessToken,
      body: {
        grade: 9,
        attendance: 95,
        reason: "Revisão pedagógica documentada",
      },
      expected: 204,
    },
  );
  const perf = (await request("/me/performance", { token })).data.find(
    (r) => r.courseId === course,
  );
  check(perf.grade, 9);
  check(perf.attendance, 95);
  check(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM saai.academic_adjustments WHERE user_id=$1",
          [learner.user.id],
        )
      ).rows[0].count,
    ),
    1,
  );
  const certificates = (await request("/me/certificates", { token })).data;
  check(certificates.length, 1);
  const certificate = (await request(`/certificates/${certificates[0].id}`))
    .data;
  check(certificate.studentName, "Aluno Restaurado");
  check("email" in certificate, false);
  const active = (
    await request(`/assessments/${originalQuiz}/sessions`, {
      method: "POST",
      token,
    })
  ).data;
  check(
    (
      await request(`/assessments/${originalQuiz}/sessions`, {
        method: "POST",
        token,
      })
    ).data.id,
    active.id,
  );
  const q = restoredQuiz.questions[0];
  const correctId = (
    await client.query(
      "SELECT id FROM saai.question_options WHERE question_id=$1 AND is_correct",
      [q.id],
    )
  ).rows[0].id;
  const wrong = q.options.find((o) => o.id !== correctId);
  await request(`/assessment-sessions/${active.id}/answers`, {
    method: "PUT",
    token,
    body: { answers: [{ questionId: q.id, optionId: wrong.id }] },
    expected: 204,
  });
  check(
    (
      await request(`/assessments/${originalQuiz}/sessions`, {
        method: "POST",
        token,
      })
    ).data.answers[0].optionId,
    wrong.id,
  );
  await client.query(
    "UPDATE saai.assessment_sessions SET deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [active.id],
  );
  await request(`/assessment-sessions/${active.id}/answers`, {
    method: "PUT",
    token,
    body: { answers: [{ questionId: q.id, optionId: correctId }] },
    expected: 409,
  });
  const body = {
    operationId: randomUUID(),
    sessionId: active.id,
    answers: [{ questionId: q.id, optionId: correctId }],
  };
  const timed = (
    await request(`/assessments/${originalQuiz}/attempts`, {
      method: "POST",
      token,
      body,
    })
  ).data;
  check(timed.score, 0);
  check(
    (
      await request(`/assessments/${originalQuiz}/attempts`, {
        method: "POST",
        token,
        body,
      })
    ).data.id,
    timed.id,
  );
  const historyCount = (await request("/me/attempts", { token })).data.length;
  await request(`/courses/${course}/restart`, {
    method: "POST",
    token,
    expected: 204,
  });
  const restarted = (await request("/me/enrollments", { token })).data.find(
    (e) => e.courseId === course,
  );
  check(restarted.learningCycle, 2);
  check(restarted.progress, 0);
  check((await request("/me/attempts", { token })).data.length, historyCount);
  check((await request("/me/certificates", { token })).data.length, 1);
  const stale = (
    await request("/sync", {
      method: "POST",
      token,
      body: { operations: [first] },
    })
  ).data;
  check(stale.results[0].success, false);
  await request("/sync", {
    method: "POST",
    token,
    body: {
      operations: [
        {
          operationId: randomUUID(),
          lessonId: lessons[0].id,
          learningCycle: 2,
        },
      ],
    },
  });
  check(
    (await request(`/courses/${course}/lessons`, { token })).data[0].completed,
    true,
  );
  await request(`/lessons/${lessons[1].id}`, {
    method: "PUT",
    token: teacher.accessToken,
    body: {
      moduleId: lessons[1].moduleId,
      moduleTitle: "Unidade",
      title: "Atividade revisada",
      content: "Conteúdo revisado e persistido.",
      position: 2,
    },
    expected: 204,
  });
  check(
    (await request(`/courses/${course}/lessons`, { token })).data[1].title,
    "Atividade revisada",
  );
  await request(`/modules/${lessons[0].moduleId}`, {
    method: "PUT",
    token: teacher.accessToken,
    body: {
      title: "Unidade agendada",
      position: 1,
      availableFrom: "2099-01-01T00:00:00Z",
    },
    expected: 204,
  });
  check(
    (await request(`/courses/${course}/lessons`, { token })).data[0].available,
    false,
  );
  await request(`/modules/${lessons[0].moduleId}`, {
    method: "PUT",
    token: teacher.accessToken,
    body: { title: "Fundamentos", position: 1, availableFrom: null },
    expected: 204,
  });
  await request(`/lessons/${lessons[1].id}`, {
    method: "DELETE",
    token: teacher.accessToken,
    expected: 204,
  });
  check(
    (await request(`/courses/${course}/lessons`, { token })).data.length,
    1,
  );
  check(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM saai.lesson_progress WHERE user_id=$1 AND lesson_id=$2",
          [learner.user.id, lessons[1].id],
        )
      ).rows[0].count,
    ),
    1,
  );
  await request("/announcements", {
    method: "POST",
    token: teacher.accessToken,
    body: { title: "Não permitido", content: "Aviso" },
    expected: 403,
  });
  await request("/announcements", {
    method: "POST",
    token: admin.accessToken,
    body: {
      title: "Aviso institucional",
      content: "Comunicado persistente para todos os alunos.",
    },
    expected: 201,
  });
  check(
    (await request("/announcements", { token })).data.some(
      (n) => n.title === "Aviso institucional",
    ),
    true,
  );
  const startsAt = new Date().toISOString(),
    endsAt = new Date(Date.now() + 3600000).toISOString();
  await request("/calendar", {
    method: "POST",
    token: teacher.accessToken,
    body: {
      title: "Encontro de revisão",
      description: "Evento acadêmico de teste",
      startsAt,
      endsAt,
    },
    expected: 201,
  });
  const from = new Date(Date.now() - 86400000).toISOString(),
    until = new Date(Date.now() + 86400000).toISOString();
  check(
    (
      await request(
        `/calendar?from=${encodeURIComponent(from)}&until=${encodeURIComponent(until)}`,
        { token },
      )
    ).data.some((e) => e.title === "Encontro de revisão"),
    true,
  );
  await client.query(
    "UPDATE saai.lessons SET archived=false,title=$2,content=$3 WHERE id=$1",
    [lessons[1].id, originalSecond.title, originalSecond.content],
  );
  return checks;
}
function profilePayload(p) {
  return {
    name: p.name,
    cpf: p.cpf,
    phone: p.phone,
    address: p.address,
    city: p.city,
    state: p.state,
    postalCode: p.postalCode,
  };
}
