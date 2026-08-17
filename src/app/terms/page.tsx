import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/compliance/PolicyPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "利用規約 | 発掘LAB",
  description: "発掘LABの利用条件、禁止事項、免責事項について説明します。",
  canonical: "/terms",
});

export default function TermsPage() {
  return (
    <PolicyPage eyebrow="TERMS OF USE" title="利用規約" description="発掘LABを利用する前に、以下の条件をご確認ください。サイトを利用した時点で、本規約に同意したものとみなします。">
      <PolicySection title="利用対象と提供内容">
        <p>当サイトは18歳以上の方のみ利用できます。18歳未満の方は閲覧・利用できません。</p>
        <p>発掘LABは、FANZA作品の価格、レビュー、ランキング、セール情報等を独自に整理・分析して提供する情報メディアです。掲載情報は購入判断の参考を目的とし、作品の品質、満足度、特定の成果を保証しません。</p>
      </PolicySection>
      <PolicySection title="外部サイトでの取引">
        <p>発掘LABは商品の販売者ではありません。商品の購入契約、支払い、キャンセル、返金、視聴条件、問い合わせ対応はリンク先事業者との間で行われます。購入前にFANZA公式ページの価格、販売条件、利用規約をご確認ください。</p>
      </PolicySection>
      <PolicySection title="禁止事項">
        <ul className="list-disc space-y-2 pl-6">
          <li>法令または公序良俗に反する行為</li>
          <li>18歳未満の方による利用、または年齢確認を不正に回避する行為</li>
          <li>不正アクセス、攻撃、脆弱性の悪用、運営を妨害する行為</li>
          <li>サーバーへ過度な負荷を与える自動取得、複製、再配布</li>
          <li>当サイトや第三者の著作権、商標権、肖像権、プライバシーその他の権利を侵害する行為</li>
          <li>虚偽情報の送信、なりすまし、その他運営者が不適切と判断する行為</li>
        </ul>
      </PolicySection>
      <PolicySection title="知的財産権">
        <p>発掘LAB独自の文章、デザイン、分析、集計結果、プログラムに関する権利は運営者または正当な権利者に帰属します。商品名、画像、動画、商標等の権利はDMM/FANZA、メーカー、出演者その他の権利者に帰属します。</p>
      </PolicySection>
      <PolicySection title="情報の変更・停止と免責">
        <p>情報の正確性・最新性の向上に努めますが、取得時差、外部サービスの変更、誤り等により表示が実際と異なる場合があります。当サイトは、保守、障害、災害、外部サービスの停止その他必要な場合に、予告なく内容を変更・中断することがあります。</p>
        <p>法令で認められる範囲において、当サイトの利用または利用不能、外部サイトでの取引により生じた損害について責任を負いません。ただし、運営者の故意または重過失による場合など、法令上免責が認められない範囲を除きます。</p>
      </PolicySection>
      <PolicySection title="規約の変更と連絡">
        <p>必要に応じて本規約を変更することがあります。重要な変更は当ページで告知し、掲載時点から適用します。</p>
        <p>誤掲載、権利、規約に関する連絡は<Link href="/contact" className="font-bold text-pink-700 underline">お問い合わせ</Link>をご利用ください。</p>
      </PolicySection>
    </PolicyPage>
  );
}
