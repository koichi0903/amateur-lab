import { supabase } from "../lib/supabase";

export default async function TestPage() {
  const { data } = await supabase
    .from("works")
    .select("*");

  return (
    <main style={{ padding: "20px" }}>
      <h1>発掘ランキング</h1>

      {data?.map((work) => (
        <div
          key={work.id}
          style={{
            border: "1px solid #ddd",
            padding: "16px",
            marginBottom: "12px",
            borderRadius: "8px",
          }}
        >
          <h2>{work.title}</h2>
         <p>
  ジャンル: {
    work.genre
      ?.split(" / ")
      .slice(0, 4)
      .join(" / ")
  }
  {work.genre?.split(" / ").length > 4 && " ..."}
</p>
          <p>発掘スコア: {work.score}</p>
        </div>
      ))}
    </main>
  );
}