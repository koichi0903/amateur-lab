import type { ReactNode } from "react";
import GuideAffiliateCtaTracker from "@/app/guides/GuideAffiliateCtaTracker";
import DmmAffiliateBanner from "@/app/guides/DmmAffiliateBanner";

const officialSources = [
  { label: "DMMプレミアムの料金・無料体験", href: "https://premium.dmm.com/about/" },
  { label: "FANZA TVの対象作品・利用条件", href: "https://support.fanza.jp/fanza-tv/article/47682" },
  { label: "FANZA TVの視聴期間", href: "https://support.fanza.jp/fanza-tv/article/47683" },
  { label: "無料体験の適用条件", href: "https://support.dmm.com/premium/article/47506" },
  { label: "無料体験中の解約", href: "https://support.dmm.com/premium/article/48411" },
  { label: "有料継続中の解約", href: "https://support.dmm.com/premium/article/48412" },
  { label: "単品動画の視聴・ダウンロード期限", href: "https://support.fanza.jp/digital/article/14311" },
  { label: "FANZA TV Plusの料金", href: "https://support.fanza.jp/fanza-tv/article/47771" },
  { label: "FANZA TV Plusの解約", href: "https://support.fanza.jp/fanza-tv/article/47773" },
] as const;

const questions = [
  { title: "新しい作品を継続して探したい", body: "今見たい作品と、ほかに見たい作品がFANZA TVの対象にあるか確認します。" },
  { title: "特定の1本だけ見たい", body: "その作品がTV対象か、単品ではいくらかを確認します。" },
  { title: "同じ作品を後日も見返したい", body: "単品の視聴期限・ストリーミング期限・ダウンロード期限を確認します。" },
] as const;

const comparisonRows = [
  ["料金", "DMMプレミアムのWeb通常月額550円（税込）。App Store・Google Playからの登録は650円（税込）", "作品・購入形式ごとに異なる"],
  ["見られる範囲", "FANZA TVの対象作品", "購入した作品・形式"],
  ["視聴できる期間", "プレミアム会員登録中。未登録になると視聴できなくなる", "商品ごとの視聴期限・ストリーミング期限に従う"],
  ["確認する条件", "希望作品、契約プラン、無料体験の適用、課金・更新の時期", "価格、画質、視聴期限、ダウンロード期限"],
  ["合うかを考える目安", "契約中に見たい対象作品が複数あり、料金と利用条件に納得できる", "目的が特定作品で、単品の価格と利用条件に納得できる"],
] as const;

const decisionRows = [
  ["既存契約で希望作品を視聴できる", "新規登録をせず、現在の契約を利用する"],
  ["希望作品が標準TV対象で、契約中に複数作品を見たい", "月額と単品合計を比較し、条件に合えば標準TVを検討する"],
  ["特定の1本が目的で、単品価格と期限が自分に合う", "単品購入を検討する"],
  ["希望作品がTV対象外", "その作品の単品販売・利用条件を確認する。TVへの登録では解決しない"],
  ["長く見返したい", "単品の各期限を確認して判断する。単品なら永久に見られるとは考えない"],
  ["対象作品・プラン・無料体験条件が確認できない", "今回は登録・購入を見送り、確認できてから判断する"],
] as const;

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-bold text-pink-700 underline decoration-pink-300 underline-offset-2 hover:text-pink-600">{children}</a>;
}

function Table({ headers, rows }: { headers: readonly string[]; rows: readonly (readonly string[])[] }) {
  return <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
    <table className="w-full min-w-[620px] border-collapse text-left text-xs leading-6">
      <thead><tr>{headers.map((header) => <th key={header} scope="col" className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900">{header}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`border-b border-slate-100 px-3 py-2 align-top text-slate-700 last:border-b-0 ${index === 0 ? "font-black text-slate-900" : ""}`}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export default function FanzaSubscriptionGuideBody() {
  return <div className="mt-6 space-y-8">
    <section aria-labelledby="fanza-tv-q1">
      <h2 id="fanza-tv-q1" className="text-lg font-black text-slate-950">Q1. 今回は何を、いつまで見たいですか？</h2>
      <ul className="mt-3 space-y-2">{questions.map((item) => <li key={item.title} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700"><strong className="text-slate-950">{item.title}：</strong>{item.body}</li>)}</ul>
      <p className="mt-3 text-sm leading-7 text-slate-700">「新作を見たい」だけで、FANZA TVに登録する必要はありません。希望する新作が対象外なら、その目的はTV登録では満たせません。</p>
    </section>

    <section aria-labelledby="fanza-tv-q2">
      <h2 id="fanza-tv-q2" className="text-lg font-black text-slate-950">Q2. 見たい作品は、標準のFANZA TVで視聴できますか？</h2>
      <p className="mt-3 text-sm leading-7 text-slate-700"><SourceLink href="https://support.fanza.jp/fanza-tv/article/47682">公式の対象作品一覧や作品ページ</SourceLink>で、希望する作品・版を確かめてください。標準TVと、追加料金が必要なFANZA TV Plusを取り違えないことも大切です。</p>
      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold leading-6 text-amber-950">対象外なら、その作品のためにTVへ登録しないでください。対象か分からない場合も、確認できるまで登録の判断を見送れます。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">この比較では、個別の作品を標準TVの対象作品として確認した例は掲載していません。タイトルが似ていることや、FANZAで単品販売されていることだけでは、TV対象とは判断できません。</p>
    </section>

    <section aria-labelledby="fanza-tv-q3">
      <h2 id="fanza-tv-q3" className="text-lg font-black text-slate-950">Q3. すでに利用できる契約や、過去の登録歴はありますか？</h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">DMMプレミアムに加入済みなら、現在の契約でFANZA TVを利用できるかを先に確認しましょう。利用できる場合は、新たな契約を勧めません。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700"><SourceLink href="https://support.fanza.jp/fanza-tv/article/47682">公式案内</SourceLink>では、「DMM | Disney+ セットプラン」でFANZA TV・FANZA TV Plusを利用できないとされています。プレミアム会員という名前だけで判断せず、契約中のプランを確認してください。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">過去にプレミアムへ登録したことがある場合は、無料体験が使える前提で比較しないでください。アカウントごとの適用可否は、<SourceLink href="https://support.dmm.com/premium/article/47506">登録画面の条件</SourceLink>で確かめます。</p>
    </section>

    <section aria-labelledby="fanza-tv-q4">
      <h2 id="fanza-tv-q4" className="text-lg font-black text-slate-950">Q4. 同じ視聴目的で、料金と期限を比べましたか？</h2>
      <Table headers={["比較すること", "標準FANZA TV", "単品購入"]} rows={comparisonRows} />
      <p className="mt-3 text-sm leading-7 text-slate-700">本数だけで結論を決めず、同じ作品・画質・利用期間で比較できているかを確かめましょう。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">例えば、見たい2作品の単品価格が仮に各300円なら合計600円です。Web通常月額550円との差は50円ですが、両方がTV対象であることが前提です。これは仮の計算で、実在作品の価格や対象範囲を確認した例ではありません。長く見返したい場合は、料金差だけでなく視聴できる期間も比べてください。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">単品でも、ダウンロードしたから永久に視聴できるとは限りません。<SourceLink href="https://support.fanza.jp/digital/article/14311">視聴期限付きの商品</SourceLink>は期限後に利用できず、「無期限」の商品にも取り扱い終了などの例外があります。</p>
    </section>

    <section aria-labelledby="fanza-tv-decision">
      <h2 id="fanza-tv-decision" className="text-lg font-black text-slate-950">4つを確認した後の選び方</h2>
      <Table headers={["確認できた状況", "選択肢"]} rows={decisionRows} />
    </section>

    <section aria-labelledby="fanza-tv-trial">
      <h2 id="fanza-tv-trial" className="text-lg font-black text-slate-950">無料体験と自動更新は、申し込み前に確認する</h2>
      <p className="mt-3 text-sm leading-7 text-slate-700"><SourceLink href="https://premium.dmm.com/about/">公式案内</SourceLink>では、条件を満たす初回登録に14日間の無料体験があります。支払方法や登録プランによって対象外となる場合があり、全員が無料になるわけではありません。無料体験の終了後も契約を継続すると、月額料金が発生し、自動更新になります。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">標準FANZA TVを利用するDMMプレミアムでは、解約の時期と登録方法で扱いが異なります。</p>
      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
        <li className="rounded-md border border-slate-200 bg-white px-3 py-3"><strong className="text-slate-950">無料体験中：</strong>Webなどでは原則として即時解約となり、残り期間があっても利用できなくなります。ただし、Amazon・Apple・Googleのアプリ内課金で登録した場合は、有効期限まで利用できます。<SourceLink href="https://support.dmm.com/premium/article/48411">公式の解約案内</SourceLink></li>
        <li className="rounded-md border border-slate-200 bg-white px-3 py-3"><strong className="text-slate-950">有料継続中：</strong>解約手続き後も有効期限までは利用でき、期限を迎えると解約されます。<SourceLink href="https://support.dmm.com/premium/article/48412">公式の解約案内</SourceLink></li>
      </ul>
      <p className="mt-3 text-sm leading-7 text-slate-700">まず現在の契約を確認し、次の請求が発生する前に、契約画面で初回・次回の課金日、有効期限、解約手順を確かめてください。無料体験の適用や期限が不明なら、新規登録を止めて公式画面で確認してから判断できます。この説明はPlusの契約条件や、単品作品の視聴期限とは別です。</p>
    </section>

    <section aria-labelledby="fanza-tv-plus">
      <h2 id="fanza-tv-plus" className="text-lg font-black text-slate-950">FANZA TV Plusとの違いにも注意</h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">Plusは標準TVとは別料金の追加サービスです。このページでは、標準TVの対象範囲と単品購入を比べています。Plusの対象作品を標準TVの料金で見られるとは案内していません。<SourceLink href="https://support.fanza.jp/fanza-tv/article/47771">Plusの料金</SourceLink>も別に確認してください。</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">すでにPlusを契約している場合は、Plusだけを解約してもプレミアムが自動解約されるわけではないことや、両契約の有効期限の違いにも注意してください。詳しくは<SourceLink href="https://support.fanza.jp/fanza-tv/article/47773">公式の解約案内</SourceLink>を確認してください。</p>
    </section>

    <section aria-labelledby="fanza-tv-sources">
      <h2 id="fanza-tv-sources" className="text-lg font-black text-slate-950">公式情報を確認する</h2>
      <ul className="mt-3 space-y-2 text-sm">{officialSources.map((source) => <li key={source.href}><SourceLink href={source.href}>{source.label}</SourceLink></li>)}</ul>
      <p className="mt-3 text-xs text-slate-500">掲載内容の確認日：2026年11月3日。料金・対象作品・契約条件は変更される場合があります。</p>
    </section>

    <aside aria-label="標準FANZA TVの公式案内" className="rounded-lg border border-pink-200 bg-pink-50 p-4 sm:p-5">
      <p className="text-[10px] font-black tracking-widest text-pink-700">広告・PR</p>
      <h2 className="mt-1 text-base font-black text-slate-950">標準FANZA TVの対象作品と、無料体験の適用条件を公式で確認する</h2>
      <p className="mt-2 text-xs leading-6 text-slate-700">見たい作品・契約プラン・無料体験の条件を公式画面で確認してください。条件に合わない場合は、新規登録をせず、単品購入や見送りを選べます。</p>
      <div className="mt-4 flex min-h-[250px] justify-center overflow-hidden rounded-md bg-white p-2" aria-label="DMM公式FANZA TVバナー">
        <GuideAffiliateCtaTracker>
          <DmmAffiliateBanner />
        </GuideAffiliateCtaTracker>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">広告経由の登録・購入が所定の条件を満たすと、運営者に報酬が発生する場合があります。</p>
    </aside>
  </div>;
}
