type ActiveJobRow = { work_id: unknown };
type WorkRow = { id: number };

export function isPositiveSafeWorkId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function collectBijyoActiveWorkIds(rows: readonly ActiveJobRow[]): number[] {
  return [...new Set(rows
    .map((row) => Number(row.work_id))
    .filter(isPositiveSafeWorkId))];
}

export function hydrateBijyoActiveJobs<
  TJob extends ActiveJobRow,
  TWork extends WorkRow,
>(
  rows: readonly TJob[],
  works: readonly TWork[],
  buildReplyText: (workId: number) => string,
): Array<Omit<TJob, "reply_text" | "work"> & { reply_text: string; work: TWork | null }> {
  const worksById = new Map(works.map((work) => [work.id, work]));
  return rows.map((row) => {
    const workId = Number(row.work_id);
    return {
      ...row,
      reply_text: buildReplyText(workId),
      work: worksById.get(workId) ?? null,
    };
  });
}
