export function generateMemo(
  title: string,
  actress: string[],
  genres: string[],
  score: number
) {
  return `${actress
    .slice(0, 3)
    .join("・") || "人気女優"}出演作品。

${genres
    .slice(0, 4)
    .join("・") || "人気ジャンル"}を楽しめる作品。

発掘スコア${score}の注目作品。`;
}