import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/compliance/PolicyPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "プライバシーポリシー | 発掘LAB",
  description: "発掘LABにおけるCookie、ブラウザ保存データ、アクセス情報の取り扱いを説明します。",
  canonical: "/privacy",
});

export default function PrivacyPage() {
  return (
    <PolicyPage eyebrow="PRIVACY POLICY" title="プライバシーポリシー" description="発掘LABで利用するCookie、ブラウザ内データ、アクセス・クリック情報と、その利用目的を説明します。">
      <PolicySection title="当サイトが取り扱う情報">
        <ul className="list-disc space-y-2 pl-6">
          <li>年齢確認の回答を保存するCookie（保存期間180日）</li>
          <li>お気に入り作品ID（利用中のブラウザのlocalStorageに保存）</li>
          <li>アフィリエイトリンクのクリック記録（作品ID、ボタンの表示位置、遷移元ページ、クリック日時）</li>
          <li>お問い合わせ時に利用者が任意に提供するメールアドレス、氏名または名称、問い合わせ内容</li>
          <li>サーバーやホスティング事業者が処理するIPアドレス、User-Agent、アクセス日時、参照元、エラーログなど</li>
        </ul>
        <p>当サイトのアフィリエイトクリック記録には、IPアドレス、氏名、メールアドレス、Cookie識別子を保存していません。お気に入り情報も当サイトのデータベースへ送信せず、利用中のブラウザ内に保存されます。</p>
      </PolicySection>
      <PolicySection title="利用目的">
        <ul className="list-disc space-y-2 pl-6">
          <li>年齢確認、作品のお気に入り保存などサイト機能を提供するため</li>
          <li>閲覧傾向や購入導線の利用状況を集計し、ページと案内を改善するため</li>
          <li>不正アクセス、過剰な自動アクセス、障害を検知して安全に運営するため</li>
          <li>問い合わせへの回答、権利侵害や誤掲載への対応を行うため</li>
        </ul>
      </PolicySection>
      <PolicySection title="外部サービスとリンク先">
        <p>当サイトは、ホスティングにVercel、データ保管にSupabase、作品情報とアフィリエイトリンクにDMM/FANZA関連サービスを利用しています。これらの事業者は、サービス提供・安全管理に必要な範囲で情報を処理する場合があります。</p>
        <p>FANZAなど外部サイトへ移動した後の情報取り扱いには、移動先のプライバシーポリシーが適用されます。外部サイトへ送信する前に、そのURLと条件をご確認ください。</p>
      </PolicySection>
      <PolicySection title="保存、管理、利用者の選択">
        <p>情報は各目的の達成と法令上必要な期間に限って保存し、アクセス制限など合理的な安全管理措置を講じます。年齢確認Cookieとお気に入りはブラウザの設定から削除できます。Cookieを無効にすると年齢確認が繰り返し表示される場合があります。</p>
        <p>ご自身に関する情報の確認、訂正、削除その他の相談は、<Link href="/contact" className="font-bold text-pink-700 underline">お問い合わせ</Link>からご連絡ください。</p>
      </PolicySection>
      <PolicySection title="18歳未満の利用と改定">
        <p>当サイトは18歳以上を対象としています。18歳未満の方は利用できません。</p>
        <p>法令、利用サービス、サイト機能の変更に応じて本方針を改定することがあります。重要な変更は当ページで分かりやすく告知します。</p>
      </PolicySection>
    </PolicyPage>
  );
}
