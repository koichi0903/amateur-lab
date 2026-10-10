const activePreparations = new Map<number, Promise<unknown>>();

export function runBijyoPreparationOnce<T>(jobId: number, prepare: () => Promise<T>): Promise<T> {
  const active = activePreparations.get(jobId);
  if (active) return active as Promise<T>;
  const operation = Promise.resolve().then(prepare);
  activePreparations.set(jobId, operation);
  void operation.finally(() => {
    if (activePreparations.get(jobId) === operation) activePreparations.delete(jobId);
  }).catch(() => undefined);
  return operation;
}
