export function preserveWorkOrderByIds<T extends { id: number }>(ids: readonly number[], works: readonly T[]): T[] {
  const worksById = new Map(works.map((work) => [work.id, work]));
  return ids.flatMap((id) => {
    const work = worksById.get(id);
    return work ? [work] : [];
  });
}
