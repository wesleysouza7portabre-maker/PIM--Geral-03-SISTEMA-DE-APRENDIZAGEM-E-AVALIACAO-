import test from "node:test";
import assert from "node:assert/strict";
import { enqueue, acknowledge } from "../../../mobile/src/sync-core.mjs";

test("uma aula pode ter operações diferentes em ciclos de estudo distintos", () => {
  const previous = { operationId: "a", lessonId: "lesson-1", learningCycle: 1 };
  const current = { operationId: "b", lessonId: "lesson-1", learningCycle: 2 };
  assert.deepEqual(enqueue([previous], current), [previous, current]);
  assert.deepEqual(enqueue([previous], { ...previous, operationId: "c" }), [
    previous,
  ]);
});

test("concluir a mesma aula offline não cria duas operações", () => {
  const original = [{ operationId: "a", lessonId: "lesson-1" }];
  assert.deepEqual(
    enqueue(original, { operationId: "b", lessonId: "lesson-1" }),
    original,
  );
});
test("confirmações removem apenas sucessos e preservam falhas e novas operações concorrentes", () => {
  const queue = [
    { operationId: "a", lessonId: "1" },
    { operationId: "b", lessonId: "2" },
    { operationId: "c", lessonId: "3" },
  ];
  assert.deepEqual(
    acknowledge(queue, [
      { operationId: "a", success: true },
      { operationId: "b", success: false },
    ]),
    queue.slice(1),
  );
  assert.equal(queue.length, 3);
});
test("respostas fora do lote ou repetidas não removem outras operações", () => {
  const queue = [{ operationId: "a", lessonId: "1" }];
  assert.deepEqual(
    acknowledge(queue, [{ operationId: "b", success: true }]),
    queue,
  );
  assert.deepEqual(acknowledge(queue, []), queue);
});
