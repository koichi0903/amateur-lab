import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/compliance/PolicyPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "広告・アフィリエイトについて | 発掘LAB",
  description: "発掘LABの広告・アフィリエイト方針、ランキングと価格表示の考え方を説明します。",
  canonical: "/affiliate-disclosure",
});

export default function AffiliateDisclosurePage() {
  return (
    <PolicyPage eyebrow="ADVERTISING POLICY" title="広告・アフィリエイトについて" description="発掘LABは、読者に広告であることを分かりやすく伝えたうえで、作品選びに役立つ情報を提供します。">
      <PolicySection title="アフィリエイト広告の利用">
        <p>発掘LABはDMMアフィリエイトを利用しています。当サイト内のリンクからFANZAへ移動し商品を購入された場合、発掘LABの運営者に紹介料が支払われることがあります。リンクを経由したことを理由に、お客様の購入価格が上乗せされることはありません。</p>
        <p>広告を含む導線には、サイト共通の広告表示または購入ボタン付近の案内を設けています。</p>
      </PolicySection>
      <PolicySection title="ランキング・おすすめの方針">
        <p>ランキング、発掘スコア、おすすめ理由は、当サイトに登録された価格・レビュー・人気・セール・作品属性などのデータをもとに算出しています。個別作品から追加の広告料を受け取って掲載順位を販売するものではありません。</p>
        <p>分析結果は作品選びの参考情報であり、満足度や購入後の結果を保証するものではありません。</p>
      </PolicySection>
      <PolicySection title="価格・販売情報と取引主体">
        <p>当サイトでは取得できた販売形態のうち最安の価格を代表価格として表示することがあります。価格、割引率、セール終了日時、在庫・配信状況は変更されるため、購入直前にFANZA公式ページの表示をご確認ください。</p>
        <p>商品の販売、契約、決済、キャンセル、返金、コンテンツ提供はリンク先の事業者が行い、その事業者の利用規約が適用されます。発掘LABは販売者ではなく、FANZA/DMMの公式サイトでもありません。</p>
      </PolicySection>
      <PolicySection title="関連ページ">
        <p>当サイトのデータ利用については<Link href="/privacy" className="font-bold text-pink-700 underline">プライバシーポリシー</Link>、利用条件については<Link href="/terms" className="font-bold text-pink-700 underline">利用規約</Link>をご確認ください。</p>
        <p>広告表示に関する公的な案内は、<a href="https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/" target="_blank" rel="noreferrer" className="font-bold text-pink-700 underline">消費者庁「ステルスマーケティングに関する景品表示法の指定告示」</a>を参照しています。</p>
      </PolicySection>
    </PolicyPage>
  );
}
