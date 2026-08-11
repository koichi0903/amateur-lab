type Work = {
  review_average: number | null;
  review_count: number | null;
  ranking: number | null;
  discount_rate: number | null;

  maker: string | null;
  genre: string | null;
  series: string | null;

  actress_point: number | null;
  maker_point: number | null;
  genre_point: number | null;
  series_point: number | null;

  review_score: number | null;
  ranking_score: number | null;
  new_release_score: number | null;
};

export type AnalysisResult = {
  summary: string;
  comments: string[];
  goodPoints: string[];
  cautionPoints: string[];
  conclusion: string;
};

export function analyzeWork(
  work: Work
): AnalysisResult {
const comments: {
  priority: number;
  text: string;
}[] = [];

const goodPoints: string[] = [];
const cautionPoints: string[] = [];

// ⭐ レビュー
if ((work.review_average ?? 0) >= 4.8) {
  comments.push({
    priority: 100,
    text: `⭐ 神評価\n${work.review_average}点`,
  });
} else if ((work.review_average ?? 0) >= 4.5) {
  comments.push({
    priority: 95,
    text: `⭐ 高評価\n${work.review_average}点`,
  });
}

// 🔥 人気
if ((work.ranking ?? 9999) <= 10) {
  comments.push({
    priority: 95,
    text: `🔥 超人気\n${work.ranking}位`,
  });
} else if ((work.ranking ?? 9999) <= 50) {
  comments.push({
    priority: 90,
    text: `🔥 人気\n${work.ranking}位`,
  });
}

// 👩 女優
if ((work.actress_point ?? 0) >= 15) {
  comments.push({
    priority: 80,
    text: "👩 女優\n人気女優出演",
  });
}

// 🏭 メーカー
if ((work.maker_point ?? 0) >= 7) {
  comments.push({
  priority: 70,
  text: `🏭 メーカー\n${work.maker ?? ""}`,
});
}

// 🎭 ジャンル
if ((work.genre_point ?? 0) >= 7) {
  comments.push({
  priority: 60,
  text: "🎭 ジャンル\n人気ジャンル",
});
}

// 📚 シリーズ
if ((work.series_point ?? 0) >= 7) {
  comments.push({
  priority: 50,
  text: `📚 シリーズ\n${work.series ?? ""}`,
});
}

// 4件未満なら補完
while (comments.length < 4) {
  comments.push({
  priority: 0,
  text: "🏆 発掘LAB\n注目作品",
});
}

let summary = "";

if ((work.review_average ?? 0) >= 4.5) {
  summary += "レビュー評価が非常に高く、";
} else if ((work.review_average ?? 0) >= 4.0) {
  summary += "レビュー評価は安定しており、";
} else {
  summary += "レビュー評価は平均的ですが、";
}

if ((work.review_count ?? 0) >= 100) {
  summary += "多くのユーザーから支持されています。";
} else if ((work.review_count ?? 0) >= 20) {
  summary += "一定数のレビューが集まっています。";
} else {
  summary += "レビュー数はまだ少ない作品です。";
}

if ((work.discount_rate ?? 0) >= 50) {
  summary += " 現在は大型セール対象となっており、お得に購入できます。";
}

if ((work.ranking ?? 9999) <= 50) {
  summary += " FANZAランキング上位の人気作品です。";
}

if ((work.review_average ?? 0) >= 4.5) {
  goodPoints.push(
    `レビュー評価${work.review_average}点の高評価作品`
  );
} else {
  cautionPoints.push(
    "レビュー評価は今後の推移に注目です。"
  );
}

if ((work.review_count ?? 0) >= 20) {
  goodPoints.push(
    `レビュー数${work.review_count}件`
  );
} else {
  cautionPoints.push(
    `レビュー件数は${work.review_count ?? 0}件とまだ少なめです。`
  );
}

if ((work.discount_rate ?? 0) >= 50) {
  goodPoints.push(
    `${work.discount_rate}%OFFセール中`
  );
}

const conclusion =
  "発掘LABではレビュー・価格・ランキングを総合分析した結果、現在おすすめできる作品と判断しています。";

  const finalComments = comments
  .sort((a, b) => b.priority - a.priority)
  .slice(0, 4)
  .map((item) => item.text);

return {
  summary,
  comments: finalComments,
  goodPoints,
  cautionPoints,
  conclusion,
};
}