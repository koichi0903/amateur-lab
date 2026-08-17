import type { Metadata } from "next";
import PolicyPage, { PolicySection } from "@/components/compliance/PolicyPage";
import { pageMetadata } from "@/lib/seo";
import ContactComposer from "./ContactComposer";

export const metadata: Metadata = pageMetadata({
  title: "お問い合わせ | 発掘LAB",
  description: "発掘LABへの掲載情報の訂正、権利、プライバシー、サイトの不具合などに関するお問い合わせ窓口です。",
  canonical: "/contact",
  robots: { index: false, follow: true },
});

const contactConfigured = Boolean(
  process.env.CONTACT_EMAIL?.trim() &&
    process.env.CONTACT_FROM_EMAIL?.trim() &&
    process.env.RESEND_API_KEY?.trim(),
);

export default function ContactPage() {
  return (
    <PolicyPage
      eyebrow="CONTACT"
      title="お問い合わせ"
      description="掲載情報の訂正、権利に関する連絡、プライバシーやサイトの不具合について受け付けています。"
    >
      <PolicySection title="ご連絡の前に">
        <ul className="list-disc space-y-2 pl-6">
          <li>作品の購入、決済、視聴、キャンセル、返金は購入先のFANZA公式サポートへお問い合わせください。</li>
          <li>訂正依頼は対象ページのURL、該当箇所、正しい情報と確認できる根拠をお知らせください。</li>
          <li>権利に関する連絡は、権利者との関係、対象URL、希望する対応をお知らせください。</li>
          <li>内容により確認や返信に時間を要する場合、または返信できない場合があります。</li>
        </ul>
      </PolicySection>
      <PolicySection title="お問い合わせ窓口">
        {contactConfigured ? (
          <ContactComposer />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="font-black">お問い合わせ窓口を準備中です</p>
            <p className="mt-2 text-sm leading-7">
              運営者がCONTACT_EMAIL、CONTACT_FROM_EMAIL、RESEND_API_KEYを設定すると、このページから安全に送信できるようになります。購入・決済に関する内容はFANZA公式サポートへお問い合わせください。
            </p>
          </div>
        )}
      </PolicySection>
      <PolicySection title="個人情報の取り扱い">
        <p>
          お問い合わせで受け取った情報は、本人確認、内容の調査、返信、不正利用防止のために利用し、必要な期間に限って保管します。詳細はプライバシーポリシーをご確認ください。
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
