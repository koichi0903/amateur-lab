import type { Work } from "@/types/work";

export function getBadges(work: Work) {
  const badges: string[] = [];

  if (work.discount_rate >= 50)
    badges.push("🔥 50%以上OFF");

  if (work.review_average >= 4.7)
    badges.push("⭐ 高評価");

  if (work.review_count >= 100)
    badges.push("📝 レビュー多数");

  if (work.new_release_score >= 10)
    badges.push("🆕 新作");

  if (work.actress_point >= 8)
    badges.push("👑 人気女優");

  if (work.genre_point >= 10)
    badges.push("🎯 人気ジャンル");

  return badges.slice(0, 3);
}