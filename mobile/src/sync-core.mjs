// Funções puras compartilhadas pelos testes; operações reconhecidas são removidas por ID.
export function enqueue(queue, operation) {
  if (
    queue.some(
      (item) =>
        item.lessonId === operation.lessonId &&
        (item.learningCycle ?? 1) === (operation.learningCycle ?? 1),
    )
  )
    return queue;
  return [...queue, operation];
}
export function acknowledge(latestQueue, results) {
  const accepted = new Set(
    results.filter((item) => item.success).map((item) => item.operationId),
  );
  return latestQueue.filter((item) => !accepted.has(item.operationId));
}
