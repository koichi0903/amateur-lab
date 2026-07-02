import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-8 py-10">

        <h2 className="text-2xl font-bold text-white mb-3">
          🔬 発掘LAB
        </h2>

        <p className="mb-6 text-gray-400">
          FANZA作品分析メディア
        </p>

        <div className="grid md:grid-cols-2 gap-8">

          <div>
            <h3 className="font-bold text-white mb-3">
              コンテンツ
            </h3>

            <div className="flex flex-col gap-2">

              <Link href="/ranking">
                発掘ランキング
              </Link>

              <Link href="/search">
                作品検索
              </Link>

              <Link href="/actress">
                女優ランキング
              </Link>

              <Link href="/genre">
                ジャンルランキング
              </Link>

              <Link href="/new">
                新着作品
              </Link>

            </div>
          </div>

          <div>

            <h3 className="font-bold text-white mb-3">
              発掘LABについて
            </h3>

            <p className="text-sm leading-7 text-gray-400">
              発掘LABは、
              レビュー・ランキング・人気女優・セール情報などを
              独自アルゴリズムで分析し、
              おすすめ作品を紹介する分析メディアです。
            </p>

          </div>

        </div>

        <div className="border-t border-gray-700 mt-10 pt-6 text-sm text-gray-500">

          <p>
            © 2026 発掘LAB
          </p>

          <p className="mt-2">
            当サイトはFANZAの公式サイトではありません。
            FANZA作品の情報を独自に分析・紹介しています。
          </p>

        </div>

      </div>
    </footer>
  );
}