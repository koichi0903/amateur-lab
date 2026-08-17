import type { Metadata } from "next";
import PolicyPage, { PolicySection } from "@/components/compliance/PolicyPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "お問い合わせ | 発掘LAB",
  description: "発掘LABへの掲載情報の訂正、権利、プライバシー、その他のお問い合わせ窓口です。",
  canonical: "/contact",
  robots: { index: false, follow: true },
});

const contactEmail = (process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();

export default function ContactPage() {
  const mailto = contactEmail ? `mailto:${contactEmail}?subject=${encodeURIComponent("発掘LABへのお問い合わせ")}` : null;

  return (
    <PolicyPage eyebrow="CONTACT" title="お問い合わせ" description="掲載情報の訂正、権利に関する連絡、プライバシーに関する相談、その他のお問い合わせを受け付けます。">
      <PolicySection title="ご連絡の前に">
        <ul className="list-disc space-y-2 pl-6">
          <li>作品の購入、決済、視聴、キャンセル、返金は購入先のFANZAサポートへお問い合わせください。</li>
          <li>訂正依頼は対象ページのURL、該当箇所、正しい情報と確認できる根拠をお知らせください。</li>
          <li>権利に関する連絡は、権利者との関係、対象URL、希望する対応をお知らせください。</li>
          <li>内容により確認や回答に時間を要する場合、または回答できない場合があります。</li>
        </ul>
      </PolicySection>
      <PolicySection title="お問い合わせ窓口">
        {mailto ? (
          <>
            <p>下のボタンからメールを作成してください。送信前に宛先と内容をご確認ください。</p>
            <a href={mailto} className="inline-flex min-h-12 items-center justify-center rounded-full bg-pink-600 px-7 py-3 font-black text-white transition hover:bg-pink-500">メールで問い合わせる</a>
          </>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="font-black">お問い合わせ窓口を準備中です</p>
            <p className="mt-2 text-sm leading-7">運営者は環境変数「CONTACT_EMAIL」を設定すると、このページにメール送信ボタンを表示できます。設定完了までは、購入・決済に関する内容はFANZA公式サポートへお問い合わせください。</p>
          </div>
        )}
      </PolicySection>
      <PolicySection title="個人情報の取り扱い">
        <p>お問い合わせで受け取った情報は、本人確認、内容の調査、回答、再発防止のために利用し、必要な期間に限って保管します。詳細はプライバシーポリシーをご確認ください。</p>
      </PolicySection>
    </PolicyPage>
  );
}
