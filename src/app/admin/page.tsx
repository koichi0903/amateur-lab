"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { IGNORE_GENRES } from "../lib/genre";
import { calculateScore } from "../lib/score";

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
  item: any
) => {

  console.log(item);

const { data: actressRanking } =
  await supabase
    .from("actress_rankings")
    .select("*");

const { data: genreRanking } =
  await supabase
    .from("genre_rankings")
    .select("*");

let actressScore = 0;
let genreScore = 0;

const actresses =
  item.iteminfo?.actress?.map(
    (a: any) => a.name
  ) || [];

const genres =
  item.iteminfo?.genre?.map(
    (g: any) => g.name
  ) || [];

actresses.forEach((name: string) => {
  const found =
    actressRanking?.find(
      (a: any) =>
        name.includes(a.name)
    );

  if (found) {
    actressScore = Math.max(
      actressScore,
      found.score
    );
  }
});

genres.forEach((name: string) => {
  const found =
    genreRanking?.find(
      (g: any) =>
        g.name === name
    );

  if (found) {
    genreScore += found.score;
  }
});

const reviewAverage =
  Number(item.review?.average || 0);

const reviewCount =
  Number(item.review?.count || 0);

const discountRate =
  item.prices?.list_price
    ? Math.round(
        (
          1 -
          Number(item.prices.price) /
          Number(item.prices.list_price)
        ) * 100
      )
    : 0;

const releaseDate = item.date
  ? new Date(item.date)
  : null;

const today = new Date();

const daysFromRelease = releaseDate
  ? Math.floor(
      (today.getTime() -
        releaseDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  : 9999;

  let newReleaseBonus = 0;

if (daysFromRelease <= 7) {
  newReleaseBonus = 20;
} else if (daysFromRelease <= 30) {
  newReleaseBonus = 12;
} else if (daysFromRelease <= 90) {
  newReleaseBonus = 6;
} else if (daysFromRelease <= 180) {
  newReleaseBonus = 3;
}

const genrePoint =
  genreScore / 500;

const rankingPoint =
  item.rank
    ? Math.max(0, (1000 - item.rank) / 40)
    : 0;

const {
  actressPoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
} = calculateScore({
  reviewAverage,
  reviewCount,
  discountRate,
  actressScore,
});

const score = Math.min(
  100,
  Math.round(
    actressPoint +
    genrePoint +
    reviewPoint +
    reviewCountPoint +
    discountPoint +
    rankingPoint +
    newReleaseBonus
  )
);

  console.log(item);
  console.log("prices=", item.prices);
  console.log(
  "price=",
  item.prices?.price
);

console.log(
  "list_price=",
  item.prices?.list_price
);
  console.log("review=", item.review);
  console.log("iteminfo=", item.iteminfo);

  const { data: existing } = await supabase
  .from("works")
  .select("id")
  .eq("product_id", item.content_id)
  .maybeSingle();

if (existing) {
  return;
}

  console.log("prices object", item.prices);
console.log("price raw", item.prices?.price);
console.log("list raw", item.prices?.list_price);

console.log("rank=", item.rank);
console.log("ranking=", item.ranking);

console.log("favorite=", item.favorite);
console.log("favorite_count=", item.favorite_count);

  const { error } = await supabase
    .from("works")
    .insert([
      {
        title: item.title,
        actress:
  item.iteminfo?.actress
    ?.slice(0, 10)
    .map((a: any) => a.name)
    .join(" / ") || "",
        
        genre:
  item.iteminfo?.genre
    ?.filter(
  (g: any) =>
    !IGNORE_GENRES.includes(g.name)
)
    .slice(0, 5)
    .map((g: any) => g.name)
    .join(" / ") || "未分類",
        score,

        actress_score: actressScore,
genre_score: genreScore,

review_score: Math.round(reviewPoint),

review_count_score: Math.round(reviewCountPoint),

discount_score: Math.round(discountPoint),

ranking_score: Math.round(rankingPoint),

new_release_score: newReleaseBonus,
        
        memo:
`${item.iteminfo?.actress
  ?.map((a: any) => a.name)
  .slice(0, 3)
  .join("・") || "人気女優"}出演作品。

${item.iteminfo?.genre
  ?.filter(
  (g: any) =>
    !IGNORE_GENRES.includes(g.name)
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
  
    product_id:
  item.content_id || "",

  release_date:
  item.date || null,

maker:
  item.iteminfo?.maker?.[0]?.name || "",

series:
  item.iteminfo?.series?.[0]?.name || "",

  price:
  parseInt(item.prices?.list_price || "0"),

sale_price:
  parseInt(item.prices?.price || "0"),

  review_count:
  item.review?.count || 0,

review_average:
  item.review?.average || 0,

  discount_rate:
  item.prices?.list_price
    ? Math.round(
        (
          1 -
          Number(item.prices.price) /
          Number(item.prices.list_price)
        ) * 100
      )
    : 0,
      },
    ]);
    
  if (error) {
    alert("登録失敗");
    console.log(error);
    return;
  }

  loadWorks();
};

const updateDmmItem = async (
  item: any
) => {

  const { data: actressRanking } =
  await supabase
    .from("actress_rankings")
    .select("*");

const { data: genreRanking } =
  await supabase
    .from("genre_rankings")
    .select("*");



let actressScore = 0;
let genreScore = 0;

const actresses =
  item.iteminfo?.actress?.map(
    (a: any) => a.name
  ) || [];

const genres =
  item.iteminfo?.genre?.map(
    (g: any) => g.name
  ) || [];

  actresses.forEach((name: string) => {
  const found =
    actressRanking?.find(
      (a: any) =>
        name.includes(a.name)
    );

  if (found) {
    actressScore = Math.max(
      actressScore,
      found.score
    );
  }
});

genres.forEach((name: string) => {
  const found =
    genreRanking?.find(
      (g: any) =>
        g.name === name
    );

  if (found) {
    genreScore += found.score;
  }
});

const reviewAverage =
  Number(item.review?.average || 0);

const reviewCount =
  Number(item.review?.count || 0);

  console.log(
  item.content_id,
  item.prices
);



const discountRate =
  parseInt(item.prices?.list_price || "0")
    ? Math.round(
        (
          1 -
          parseInt(item.prices?.price || "0") /
          parseInt(item.prices?.list_price || "1")
        ) * 100
      )
    : 0;

 

const releaseDate = item.date
  ? new Date(item.date)
  : null;

const today = new Date();

const daysFromRelease = releaseDate
  ? Math.floor(
      (today.getTime() -
        releaseDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  : 9999;

  let newReleaseBonus = 0;

if (daysFromRelease <= 7) {
  newReleaseBonus = 20;
} else if (daysFromRelease <= 30) {
  newReleaseBonus = 12;
} else if (daysFromRelease <= 90) {
  newReleaseBonus = 6;
} else if (daysFromRelease <= 180) {
  newReleaseBonus = 3;
}

const genrePoint =
  genreScore / 500;

const rankingPoint =
  item.rank
    ? Math.max(0, (1000 - item.rank) / 40)
    : 0;

const {
  actressPoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
} = calculateScore({
  reviewAverage,
  reviewCount,
  discountRate,
  actressScore,
});

const score = Math.min(
  100,
  Math.round(
    actressPoint +
    genrePoint +
    reviewPoint +
    reviewCountPoint +
    discountPoint +
    rankingPoint +
    newReleaseBonus
  )
);

console.log("UPDATE DATA", {
  score,
  actress_score: actressScore,
  genre_score: genreScore,
  ranking_score: Math.round(rankingPoint),
  release_date: item.date,
  maker: item.iteminfo?.maker?.[0]?.name,
  series: item.iteminfo?.series?.[0]?.name,
  price: Number(
    item.prices?.list_price?.replace("~", "")
  ) || 0,
  sale_price: Number(
    item.prices?.price?.replace("~", "")
  ) || 0,
  review_count: item.review?.count || 0,
  review_average:
    Number(item.review?.average) || 0,
});

  const { error } = await supabase
    .from("works")
    .update({

      score: score,
actress_score: actressScore,
genre_score: genreScore,

review_score: Math.round(reviewPoint),

review_count_score: Math.round(reviewCountPoint),

discount_score: Math.round(discountPoint),

ranking_score: Math.round(rankingPoint),

new_release_score: newReleaseBonus,
      
      release_date:
        item.date || null,

      maker:
        item.iteminfo?.maker?.[0]?.name || "",

      series:
        item.iteminfo?.series?.[0]?.name || "",

      price:
  Number(
    item.prices?.list_price?.replace("~", "")
  ) || 0,

sale_price:
  Number(
    item.prices?.price?.replace("~", "")
  ) || 0,
      review_count:
        item.review?.count || 0,

      review_average:
        Number(item.review?.average) || 0,
       
      discount_rate:
  parseInt(item.prices?.list_price || "0")
    ? Math.round(
        (
          1 -
          parseInt(item.prices?.price || "0") /
          parseInt(item.prices?.list_price || "1")
        ) * 100
      )
    : 0,

      last_updated:
        new Date().toISOString(),
    })
    .eq(
      "product_id",
      item.content_id
    )

  console.log(
  "UPDATE ERROR",
  error
);
};

const updateAllWorks = async () => {
  const { data: works } = await supabase
    .from("works")
    .select("id, product_id");

  if (!works) return;

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

          if (!item) return;

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
      `${Math.min(i + batchSize, works.length)} / ${works.length} 件更新`
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

const actresses = [
  "瀬戸環奈",
  "琴音華",
  "三岳ゆうな",
  "河北彩伽",
  "松本いちか",
  "美園和花",
  "MINAMO",
  "七原さゆ",
  "石川澪",
  "北岡果林",
  "小野六花",
  "青空ひかり",
  "新妻ゆうか",
  "川越にこ",
  "伊藤舞雪",
  "篠田ゆう",
  "紗倉まな",
  "乙アリス",
  "逢沢みゆ",
  "凪ひかる",
  "美咲かんな",
  "波多野結衣",
  "七沢みあ",
  "石原希望",
  "宮下玲奈",
  "姫咲はな",
  "神宮寺ナオ",
  "深田えいみ",
  "柏木こなつ",
  "美谷朱音",
  "葵いぶき",
  "風間ゆみ",
  "森日向子",
];

const keywords = [
  "熟女",
  "人妻",
  "中出し",
  "巨乳",
  "寝取り",
  "乳首",
  "レズ",
  "ギャル",
  "アナル",
"ニューハーフ",
"マジックミラー号",
"潮吹き",
"爆乳",
"痴女",
"コスプレ",
"単体作品",
"母乳",
"ハーレム",
"素人",
"電車",
"オナニー",
"剛毛",
"洗脳",
];

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
    batch.map(async (item: any) => {
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

  console.log("ランキングAPI", data);

  const items = data.result?.items || [];

  const batchSize = 10;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  await Promise.all(
    batch.map(async (item: any) => {
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
    batch.map(async (item: any) => {
      await saveDmmItem(item);
    })
  );
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

<button
  onClick={updateAllWorks}
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 mt-2 ml-2 rounded font-bold"
>
  📥 DMMデータ再取得
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