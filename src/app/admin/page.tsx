"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { IGNORE_GENRES } from "../../lib/genre";
import { calculateScore } from "../../lib/score";
import { saveDmmItem } from "../../lib/admin/save";
import { actresses, keywords, } from "../../lib/admin/constants";
import type { Work } from "../../types/work";
import type { DmmItem } from "../../types/dmm";
import type { RankingItem } from "../../types/ranking";
import { updateDmmItem } from "@/lib/admin/update";

export default function AdminPage() {
  const ADMIN_PASSWORD = "koichi0903";

const [authenticated, setAuthenticated] =
  useState(false);

const [password, setPassword] =
  useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [score, setScore] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
const [searchResults, setSearchResults] =
  useState<DmmItem[]>([]);

async function loadWorks() {
  const { data } = await supabase
  .from("works")
  .select("*")
  .order("score", { ascending: false });

setWorks((data as Work[]) || []);
}

 useEffect(() => {
  const init = async () => {
    await loadWorks();
  };

  void init();
}, []);

const deleteWork = async (id: number) => {
  await supabase
    .from("works")
    .delete()
    .eq("id", id);

  loadWorks();
};

const startEdit = (work: Work) => {
  setEditingId(work.id);

  setTitle(work.title || "");
  setGenre(work.genre || "");
  setScore(String(work.score || ""));
  setMemo(work.memo || "");
};

const updateWork = async () => {
  if (!editingId) return;

  const { error } = await supabase
    .from("works")
    .update({
      title,
      genre,
      score: Number(score),
      memo,
    })
    .eq("id", editingId);

  if (error) {
    alert("更新失敗");
    return;
  }

  alert("更新成功");

  setEditingId(null);

  setTitle("");
  setGenre("");
  setScore("");
  setMemo("");

  loadWorks();
};

const generateMemo = () => {
  let text = "";

  if (title) {
    text += `${title}の注目作品。\n`;
  }

  // 女優
  if (genre.includes("美少女")) {
    text += "美少女系ジャンルとして人気。\n";
  }

  if (genre.includes("巨乳")) {
    text += "巨乳好きにおすすめ。\n";
  }

  if (genre.includes("ハメ撮り")) {
    text += "ハメ撮り要素を含む人気作品。\n";
  }

  if (genre.includes("パイズリ")) {
    text += "パイズリシーンを収録。\n";
  }

  if (genre.includes("中出し")) {
    text += "中出しジャンルを含む注目作品。\n";
  }

  if (genre.includes("人妻")) {
    text += "人妻ジャンルとして人気。\n";
  }

  if (genre.includes("女子大生")) {
    text += "女子大生設定の人気作品。\n";
  }

  // スコア評価
  if (Number(score) >= 95) {
    text += "発掘スコア95以上の急上昇作品。\n";
  } else if (Number(score) >= 90) {
    text += "発掘スコア90以上の人気作品。\n";
  } else if (Number(score) >= 80) {
    text += "発掘スコア80以上の注目作品。\n";
  }

  // 締めコメント
  text += "\n気になる方はチェックしておきたい作品です。";

  setMemo(text);
};

const handleSubmit = async () => {
  const { error } = await supabase
    .from("works")
    .insert([
      {
        title,
        genre,
        score: Number(score),
        memo,
      },
    ]);

  if (error) {
  console.error("作品登録エラー:", error);
  alert("登録失敗");
  return;
}

  alert("登録成功！");
  loadWorks();

  setTitle("");
  setGenre("");
  setScore("");
  setMemo("");
};

const updateAllWorks = async () => {
  const works = [];

let from = 0;
const limit = 1000;

while (true) {
  const { data } = await supabase
    .from("works")
    .select("id, product_id")
    .range(from, from + limit - 1);

  if (!data || data.length === 0) {
    break;
  }

  works.push(...data);

  if (data.length < limit) {
    break;
  }

  from += limit;
}

console.log("取得件数:", works.length);

if (works.length === 0) return;
  const batchSize = 10;

  for (let i = 0; i < works.length; i += batchSize) {
    const batch = works.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (work) => {
        if (!work.product_id) return;

        try {
          const res = await fetch(
            `/api/dmm?cid=${work.product_id}`
          );

          const data = await res.json();

          const item =
  data?.result?.items?.[0];

if (!item) {
  console.log(
    "DMMで取得できない:",
    work.product_id
  );
  return;
}

          await updateDmmItem(item);
        } catch (e) {
          console.log(
            "更新失敗",
            work.product_id,
            e
          );
        }
      })
    );

    console.log(
  `更新進捗: ${Math.min(i + batchSize, works.length)} / ${works.length}`
);
  }

  alert("更新完了");
  loadWorks();
};


const saveAllResults = async () => {
  const batchSize = 10;

  for (
    let i = 0;
    i < searchResults.length;
    i += batchSize
  ) {
    const batch = searchResults.slice(
      i,
      i + batchSize
    );

    await Promise.all(
  batch.map((item) =>
    saveDmmItem(item)
  )
);

    console.log(
      `${Math.min(i + batchSize, searchResults.length)} / ${searchResults.length} 件登録`
    );
  }

  alert("全件登録完了");
};

const fetchPopularActresses = async () => {
 for (const actress of actresses) {
    const res = await fetch(
      `/api/dmm?keyword=${encodeURIComponent(actress)}`
    );

    const data = await res.json();

    const items = data.result?.items || [];

const batchSize = 10;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  await Promise.all(
    batch.map(async (item: DmmItem) => {
      await saveDmmItem(item);
    })
  );
}
  }

  alert("人気女優取得完了");
  loadWorks();
};

const fetchRanking = async () => {
  const res = await fetch("/api/dmm-ranking");

  const data = await res.json();

  const items = data.result?.items || [];

  const batchSize = 10;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  await Promise.all(
    batch.map(async (item: DmmItem) => {
      await saveDmmItem(item);
    })
  );
}

  alert("ランキング取得完了");

  loadWorks();
};

const fetchAmateurWorks = async () => {
  for (const keyword of keywords) {
    const res = await fetch(
      `/api/dmm?keyword=${encodeURIComponent(keyword)}`
    );

    const data = await res.json();

    const items = data.result?.items || [];

    const batchSize = 10;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  await Promise.all(
    batch.map(async (item: DmmItem) => {
      await saveDmmItem(item);
    })
  );
}
  }

  alert("素人系作品取得完了");

  loadWorks();
};

const updateScore = async () => {
  setLoading(true);

  try {
    const res = await fetch("/api/score-update");
    const data = await res.json();

    alert(data.message);

    await loadWorks();
  } finally {
    setLoading(false);
  }
};

const fetchAllWorks = async () => {
  await fetchRanking();

  await fetchPopularActresses();

  await fetchAmateurWorks();

  alert("🎉 全作品収集完了");

  loadWorks();
};

const handleSearch = async () => {
  const res = await fetch(
    `/api/dmm?keyword=${encodeURIComponent(keyword)}`
  );

  const data = await res.json();

  setSearchResults(
    data.result?.items || []
  );
};

if (!authenticated) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow w-96">
        <h1 className="text-2xl font-bold mb-4">
          管理画面ログイン
        </h1>

        <input
          type="password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="border p-2 w-full"
          placeholder="パスワード"
        />

        <button
          onClick={() => {
            if (
              password ===
              ADMIN_PASSWORD
            ) {
              setAuthenticated(true);
            } else {
              alert(
                "パスワードが違います"
              );
            }
          }}
          className="bg-black text-white px-4 py-2 mt-4 rounded w-full"
        >
          ログイン
        </button>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen p-8 overflow-auto">
      <h1 className="text-3xl font-bold mb-6">
        管理画面
      </h1>

      <div className="bg-white p-6 rounded-xl shadow overflow-auto">
        <p>ここから作品を登録します。</p>
        <div className="mt-6">
  <input
    type="text"
    placeholder="DMM検索キーワード"
    value={keyword}
    onChange={(e) => setKeyword(e.target.value)}
    className="border p-2 w-full"
  />

  <button
    onClick={handleSearch}
    className="bg-blue-500 text-white px-4 py-2 mt-2 rounded"
  >
    DMM検索
  </button>
  <button
  onClick={saveAllResults}
  className="bg-orange-500 text-white px-4 py-2 mt-2 ml-2 rounded"
>
  🔥 検索結果を全部登録
</button>

<button
  onClick={fetchPopularActresses}
  className="bg-purple-600 text-white px-4 py-2 mt-2 ml-2 rounded"
>
  🔥 人気女優取得
</button>

<button
  onClick={fetchRanking}
  className="bg-red-600 text-white px-4 py-2 mt-2 ml-2 rounded"
>
  🔥 売れ筋ランキング取得
</button>

<button
  onClick={fetchAmateurWorks}
  className="bg-green-700 text-white px-4 py-2 mt-2 ml-2 rounded"
>
  🔥 素人系取得
</button>

<button
  onClick={updateAllWorks}
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 mt-2 ml-2 rounded font-bold"
>
  📥 DMMデータ再取得
</button>

<button
  onClick={updateScore}
  disabled={loading}
>
  {loading
    ? "⭐ スコア更新中..."
    : "⭐ スコア更新"}
</button>

<button
  onClick={fetchAllWorks}
  className="bg-black text-white px-4 py-2 mt-2 ml-2 rounded font-bold"
>
  🚀 全作品収集
</button>

</div>

        <input
          type="text"
          placeholder="作品名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full mt-4"
        />

       <input
  type="text"
  placeholder="ジャンル"
  value={genre}
  onChange={(e) => setGenre(e.target.value)}
  className="border p-2 w-full mt-4"
/>

<textarea
  placeholder="発掘メモ"
  value={memo}
  onChange={(e) => setMemo(e.target.value)}
  className="border p-2 w-full mt-4"
/>

<button
  onClick={generateMemo}
  className="bg-purple-600 text-white px-4 py-2 mt-2 rounded"
>
  🤖 発掘メモ生成
</button>

<input
  type="number"
  placeholder="スコア"
  value={score}
  onChange={(e) => setScore(e.target.value)}
  className="border p-2 w-full mt-4"
/>

        {editingId ? (
  <button
    onClick={updateWork}
    className="bg-blue-600 text-white px-4 py-2 mt-4 rounded"
  >
    更新
  </button>



) : (
  <button
    onClick={handleSubmit}
    className="bg-black text-white px-4 py-2 mt-4 rounded"
  >
    登録
  </button>
)}
        <div className="mt-8">
          <div className="mt-8">
  <h2 className="text-xl font-bold mb-4">
    DMM検索結果
  </h2>

  {searchResults.map((item: DmmItem, index: number) => (
    <div
      key={index}
      className="border p-3 mb-2 rounded"
    >
      <p className="font-bold">
        {item.title}
      </p>
      {item.imageURL?.large && (
  <img
    src={item.imageURL.large}
    alt={item.title}
    className="w-40 mt-2 rounded"
  />
  
)}
<button
  onClick={() => saveDmmItem(item)}
  className="bg-green-600 text-white px-4 py-2 mt-2 rounded"
>
  登録
</button>
    </div>
  ))}
</div>
  <h2 className="text-xl font-bold mb-4">
    登録済み作品
  </h2>

  {works.map((work) => (
    <div
      key={work.id}
      className="border p-3 mb-2 rounded"
    >
      <p>
        {work.title}
      </p>

      <p>
        {work.genre}
      </p>

      <p>
        スコア: {work.score}
      </p>

<p>
  女優スコア: {work.actress_score}
</p>

<p>
  ジャンルスコア: {work.genre_score}
</p>


      <p>
  メモ: {work.memo}
</p>

<button
  onClick={() => startEdit(work)}
  className="bg-blue-500 text-white px-3 py-1 rounded mt-2 mr-2"
>
  編集
</button>

      <button
  onClick={() => deleteWork(work.id)}
  className="bg-red-500 text-white px-3 py-1 rounded mt-2"
>
  削除
</button>
    </div>
  ))}
</div>
      </div>
    </main>
  );
}