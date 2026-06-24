"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminPage() {
  const ADMIN_PASSWORD = "koichi0903";

const [authenticated, setAuthenticated] =
  useState(false);

const [password, setPassword] =
  useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [score, setScore] = useState("");
  const [works, setWorks] = useState<any[]>([]);
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
const [searchResults, setSearchResults] = useState<any[]>([]);
 useEffect(() => {
  loadWorks();
}, []);

const deleteWork = async (id: number) => {
  await supabase
    .from("works")
    .delete()
    .eq("id", id);

  loadWorks();
};

const startEdit = (work: any) => {
  setEditingId(work.id);

  setTitle(work.title || "");
  setGenre(work.genre || "");
  setScore(String(work.score || ""));
  setMemo(work.memo || "");
};

const loadWorks = async () => {
  const { data } = await supabase
    .from("works")
    .select("*")
    .order("score", { ascending: false });

  setWorks(data || []);
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
    alert("登録失敗");
    console.log(error);
    return;
  }

  alert("登録成功！");
  loadWorks();

  setTitle("");
  setGenre("");
  setScore("");
  setMemo("");
};

const saveDmmItem = async (
  item: any,
  score = 80
) => {

  const { data: existing } = await supabase
  .from("works")
  .select("id")
  .eq("product_id", item.content_id)
  .maybeSingle();

if (existing) {
  return;
}

  const ignoreGenres = [
    "ハイビジョン",
    "4K",
    "独占配信",
    "単体作品",
    "デジモ",
    "期間限定セール",
  "セット商品",
  "サンプル動画",
  ];

  const { error } = await supabase
    .from("works")
    .insert([
      {
        title: item.title,
        
        genre:
  item.iteminfo?.genre
    ?.filter(
      (g: any) =>
        !ignoreGenres.includes(g.name)
    )
    .slice(0, 5)
    .map((g: any) => g.name)
    .join(" / ") || "未分類",
        score,
        memo:
`${item.iteminfo?.actress
  ?.map((a: any) => a.name)
  .slice(0, 3)
  .join("・") || "人気女優"}出演作品。

${item.iteminfo?.genre
  ?.filter(
    (g: any) =>
      !ignoreGenres.includes(g.name)
  )
  .slice(0, 4)
  .map((g: any) => g.name)
  .join("・") || "人気ジャンル"}を楽しめる作品。

発掘スコア${score}の注目作品。`,

        image_url:
          item.imageURL?.large ||
          item.imageURL?.list ||

          "",

        affiliate_url:
          item.affiliateURL || "",

          url:
  item.URL || "",
  actress:
  item.iteminfo?.actress
    ?.map((a: any) => a.name)
    .join(" / ") || "",

    product_id:
  item.content_id || "",
      },
    ]);

  if (error) {
    alert("登録失敗");
    console.log(error);
    return;
  }

  loadWorks();
};






const saveAllResults = async () => {
  for (const item of searchResults) {
    await saveDmmItem(item);
  }

  alert("全件登録完了");
};

const actresses = [
  "河北彩花",
  "石川澪",
  "葵つかさ",
  "美谷朱里",
  "七沢みあ",
  "楪カレン",
  "楓ふうあ",
  "八木奈々",
  "天使もえ",
  "深田えいみ",
  "瀬戸環奈",
];

const keywords = [
  "素人",
  "ナンパ",
  "女子大生",
  "人妻",
  "中出し",
  "フェラ",
  "巨乳",
  "美少女",
  "ギャル",
"OL",
"寝取り",
"痴女",
"パイズリ",
"騎乗位",
"潮吹き",
"顔射",
"温泉",
"マジックミラー号",
"企画",
"寝取られ",
"童顔",
"美乳",
"ハメ撮り",
];

const fetchPopularActresses = async () => {

  for (const actress of actresses) {
    const res = await fetch(
      `/api/dmm?keyword=${encodeURIComponent(actress)}`
    );

    const data = await res.json();

    const items = data.result?.items || [];

    for (const item of items) {
      await saveDmmItem(item, 90);
    }
  }

  alert("人気女優取得完了");
  loadWorks();
};

const fetchRanking = async () => {
  const res = await fetch("/api/dmm-ranking");

  const data = await res.json();

  const items = data.result?.items || [];

  for (const item of items) {
    await saveDmmItem(item, 95);
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

    for (const item of items) {
      await saveDmmItem(item, 92);
    }
  }

  alert("素人系作品取得完了");

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

  {searchResults.map((item: any, index) => (
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