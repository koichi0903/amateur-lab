type Props = {
  totalWorks: number;
  totalActresses: number;
  totalMakers: number;
  totalSeries: number;
  totalGenres: number;
  lastUpdatedAt: string | null;
};

export default function SiteStatistics({
  totalWorks,
  totalActresses,
  totalMakers,
  totalSeries,
  totalGenres,
  lastUpdatedAt,
}: Props) {
  return (
    <div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-3xl font-bold">
        📈 現在の分析データ
      </h2>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">

        <div className="rounded-xl bg-indigo-50 p-5 text-center">
          <p className="text-sm text-gray-500">分析作品</p>
          <p className="mt-2 text-3xl font-black text-indigo-600">
            {totalWorks.toLocaleString()}作品
          </p>
        </div>

        <div className="rounded-xl bg-pink-50 p-5 text-center">
          <p className="text-sm text-gray-500">女優</p>
          <p className="mt-2 text-3xl font-black text-pink-600">
            {totalActresses.toLocaleString()}名
          </p>
        </div>

        <div className="rounded-xl bg-green-50 p-5 text-center">
          <p className="text-sm text-gray-500">メーカー</p>
          <p className="mt-2 text-3xl font-black text-green-600">
            {totalMakers.toLocaleString()}社
          </p>
        </div>

        <div className="rounded-xl bg-yellow-50 p-5 text-center">
          <p className="text-sm text-gray-500">シリーズ</p>
          <p className="mt-2 text-3xl font-black text-yellow-600">
            {totalSeries.toLocaleString()}件
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 p-5 text-center">
          <p className="text-sm text-gray-500">ジャンル</p>
          <p className="mt-2 text-3xl font-black text-blue-600">
            {totalGenres.toLocaleString()}種類
          </p>
        </div>

      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        ※ データは発掘LABのデータベースをもとに毎日更新しています。
      </p>

      <p className="mt-2 text-center text-sm text-gray-500">
        最終更新：
        {lastUpdatedAt
          ? new Date(lastUpdatedAt).toLocaleString("ja-JP")
          : "-"}
      </p>
    </div>
  );
}