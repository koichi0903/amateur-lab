export type RankingSnapshotRow = {
  work_id: number;
  ranking: number;
  captured_date: string;
  captured_at: string;
};

export type RankingHistory = {
  observations: number;
  previousRanking: number | null;
};

function summarizeWorkHistory(rows: readonly RankingSnapshotRow[]): RankingHistory {
  const latestByDate = new Map<string, { ranking: number; captured_at: string }>();
  for (const row of rows) {
    const current = latestByDate.get(row.captured_date);
    if (!current || row.captured_at > current.captured_at) {
      latestByDate.set(row.captured_date, { ranking: row.ranking, captured_at: row.captured_at });
    }
  }
  const ordered = [...latestByDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return { observations: ordered.length, previousRanking: ordered[1]?.[1].ranking ?? null };
}

export function buildRankingSnapshotHistories(rows: readonly RankingSnapshotRow[]) {
  const grouped = new Map<number, RankingSnapshotRow[]>();
  for (const row of rows) {
    if (!row.work_id || !row.ranking) continue;
    grouped.set(row.work_id, [...(grouped.get(row.work_id) ?? []), row]);
  }

  const histories = new Map<number, RankingHistory>();
  for (const [workId, workRows] of grouped) {
    histories.set(workId, summarizeWorkHistory(workRows));
  }
  return histories;
}
