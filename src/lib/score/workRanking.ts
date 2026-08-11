/**
 * 発掘LAB Ver.2
 * 人気度ポイント計算
 */

function getRealtimePoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 10) return 25;
  if (rank <= 20) return 24;
  if (rank <= 30) return 23;
  if (rank <= 40) return 22;
  if (rank <= 50) return 21;
  if (rank <= 60) return 20;
  if (rank <= 70) return 19;
  if (rank <= 80) return 18;
  if (rank <= 90) return 17;
  if (rank <= 100) return 16;

  return 0;
}

function getDailyPoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank === 1) return 25;
  if (rank === 2) return 24;
  if (rank === 3) return 23;
  if (rank === 4) return 22;
  if (rank === 5) return 21;
  if (rank === 6) return 20;
  if (rank === 7) return 19;
  if (rank === 8) return 18;
  if (rank === 9) return 17;
  if (rank === 10) return 16;
  if (rank <= 12) return 15;
  if (rank <= 14) return 14;
  if (rank <= 16) return 13;
  if (rank <= 18) return 12;
  if (rank <= 20) return 11;

  return 0;
}

function getWeeklyMonthlyPoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 25;
  if (rank <= 10) return 24;
  if (rank <= 15) return 23;
  if (rank <= 20) return 22;
  if (rank <= 25) return 21;
  if (rank <= 30) return 20;
  if (rank <= 35) return 19;
  if (rank <= 40) return 18;
  if (rank <= 45) return 17;
  if (rank <= 50) return 16;
  if (rank <= 55) return 15;
  if (rank <= 60) return 14;
  if (rank <= 65) return 13;
  if (rank <= 70) return 12;
  if (rank <= 75) return 11;
  if (rank <= 80) return 10;
  if (rank <= 85) return 9;
  if (rank <= 90) return 8;
  if (rank <= 95) return 7;
  if (rank <= 100) return 6;

  return 0;
}

export function getPopularityPoint(work: {
  realtime_rank: number | null;
  daily_rank: number | null;
  weekly_rank: number | null;
  monthly_rank: number | null;
}) {
  return Math.max(
    getRealtimePoint(work.realtime_rank),
    getDailyPoint(work.daily_rank),
    getWeeklyMonthlyPoint(work.weekly_rank),
    getWeeklyMonthlyPoint(work.monthly_rank)
  );
}

export function getLongHitPoint(longHitRank: number | null): number {
  if (!longHitRank) return 0;

  if (longHitRank <= 50) return 10;
  if (longHitRank <= 100) return 9;
  if (longHitRank <= 150) return 8;
  if (longHitRank <= 200) return 7;
  if (longHitRank <= 300) return 6;
  if (longHitRank <= 400) return 5;
  if (longHitRank <= 500) return 4;
  if (longHitRank <= 600) return 3;
  if (longHitRank <= 700) return 2;
  if (longHitRank <= 1000) return 1;

  return 0;
}