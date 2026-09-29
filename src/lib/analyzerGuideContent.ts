import type { EditorialLink, EditorialSection } from "@/lib/editorialContent";

export type AnalyzerGuide = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  intro?: readonly string[];
  sections: readonly EditorialSection[];
  faq: readonly { question: string; answer: string }[];
  related: readonly EditorialLink[];
  cta?: { label: string; href: string; eyebrow: string; title: string; body: string };
  inlineCta?: { label: string; href: string; body: string };
  topLinks?: readonly EditorialLink[];
  steps?: readonly { sectionTitle: string; title: string; body: string }[];
  serviceLinks?: readonly { label: string; href: string }[];
  internalLinks?: readonly { label: string; href: string }[];
};

export const analyzerGuideArticles: readonly AnalyzerGuide[] = [
  {
    slug: "fanza-live-chat",
    eyebrow: "広告・PR",
    title: "FANZAライブチャットとは？動画との違いと楽しみ方を徹底解説",
    description: "リアルタイムで楽しめるFANZAライブチャットの基本から、ポイント購入・使い方・注意点まで詳しく解説します。",
    summary: "FANZAライブチャットは、女優・モデルのライブ配信をリアルタイムで楽しめるサービスです。動画作品との違いと、利用前に確認したいポイントを整理します。",
    intro: ["FANZAライブチャット（旧：DMMライブチャット）は、FANZA（旧DMM.R18）が提供するリアルタイム生配信サービスです。女優・モデルがライブ配信を行い、視聴者はチャットやポイント投げ銭でリアルタイムにやり取りができます。", "録画済みの動画を「購入して視聴する」従来のFANZA動画とは異なり、ライブチャットは「今この瞬間」を共有する体験型コンテンツです。好みの配信者を見つけて応援する楽しさは、動画AVとはまた別の魅力があります。"],
    sections: [
      { title: "FANZAライブチャットとは？", paragraphs: ["FANZAライブチャット（旧DMMライブチャット）は、FANZAが提供するリアルタイム生配信サービスです。女優・モデルがライブ配信を行い、視聴者はチャットやポイント投げ銭でリアルタイムにやり取りできます。", "録画済みの動画を購入して視聴する従来のFANZA動画とは異なり、「今この瞬間」を共有する体験型コンテンツです。お気に入りの配信者を見つけて応援する楽しさは、動画AVとは別の魅力があります。"] },
      { title: "FANZA動画との違い", paragraphs: ["動画は作品を購入して好きな時間に視聴するサービス、ライブチャットは配信者とリアルタイムで交流するサービスです。料金体系や無料視聴できる範囲も異なるため、目的に合う方を選びます。"], points: ["配信形式：ライブチャットはリアルタイム生配信、動画は録画済み", "やり取り：ライブチャットはチャット・投げ銭で双方向", "料金体系：ライブチャットはポイント消費、動画は作品ごとの買い切り", "無料視聴：ライブチャットはフリーエリア、動画はサンプル", "アーカイブ：ライブチャットは基本的に生配信のみ"] },
      { title: "ポイント購入手順", paragraphs: ["ライブチャットは完全先払いのポイント制です。あらかじめポイントを購入し、女の子と話した時間に応じてポイントが消費されます。使い過ぎを防ぐため、入室前に残ポイントと料金を確認してください。"] },
      { title: "利用前に知っておきたい注意点", paragraphs: ["ポイントの有効期限、プライベートエリアの消費量、配信スケジュールを確認してから利用してください。ライブ配信は常に同じ内容が見られるとは限らず、アーカイブされない場合もあります。"], points: ["ポイントの有効期限に注意", "プライベートエリアはポイント消費が速い", "アーカイブは保証されない", "18歳未満は利用不可"] },
    ],
    faq: [{ question: "ライブチャットは無料で見られますか？", answer: "フリーエリアは無料で視聴できます。有料エリアやプライベートエリアではポイントが必要です。" }, { question: "動画とライブチャットはどちらがおすすめですか？", answer: "好きな時間に作品を見たい場合は動画、リアルタイムの交流を楽しみたい場合はライブチャットが向いています。" }],
    related: [{ href: "/guides/fanza-sale-timing", label: "FANZAのセールはいつ？" }, { href: "/guides/fanza-registration", label: "FANZAの登録方法を見る" }, { href: "/sale", label: "今日のFANZAセール情報を見る" }],
    inlineCta: { label: "ライブチャットを開く", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Flivechat.dmm.co.jp%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", body: "配信中の部屋や無料エリアは公式ページで確認できます。" },
    steps: [
      { sectionTitle: "ポイント購入手順", title: "① FANZAアカウントにログイン", body: "FANZA公式サイトにアクセスし、登録済みのメールアドレスとパスワードでログインします。まだ登録していない方は先に会員登録が必要です（無料）。" },
      { sectionTitle: "ポイント購入手順", title: "② ライブチャットページを開く", body: "トップページのナビゲーションから「ライブチャット」を選択します。または「FANZA ライブチャット」で検索してアクセスします。" },
      { sectionTitle: "ポイント購入手順", title: "③ ポイント購入ページへ移動", body: "ライブチャットページ右上の「ポイント購入」ボタンをクリックすると、購入できるポイント数のプランが表示されます。" },
      { sectionTitle: "ポイント購入手順", title: "④ プランを選択して決済", body: "購入したいポイント数を選び、クレジットカード・キャリア決済・電子マネーなどで決済します。ポイントは即時反映されます。" },
      { sectionTitle: "ポイント購入手順", title: "⑤ 好みの配信者の部屋に入室", body: "ライブ一覧から気になる配信者を選んでクリックすると入室できます。フリーエリアは無料で視聴できます。" },
    ],
    cta: { label: "FANZAライブチャットを見る", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Flivechat.dmm.co.jp%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", eyebrow: "PR", title: "FANZAライブチャットを今すぐ体験", body: "フリーエリアは無料で視聴できます。まずは配信者を探してみましょう。" },
  },
  {
    slug: "fanza-sale-timing",
    eyebrow: "広告・PR",
    title: "FANZAのセールはいつ？過去データから読み解くお得な買い時",
    description: "価格推移データをもとに、FANZAセールのパターンと傾向を分析。10円セール・半額セールを見逃さない方法を紹介します。",
    summary: "FANZAでは、ほぼ毎日何らかのセールが実施されています。価格履歴データをもとに、セールの種類と買い時の見極め方を整理します。",
    intro: ["FANZAでは、ほぼ毎日何らかのセールが実施されています。しかし「どのタイミングで買えば最安値なのか」を把握するのは難しいですよね。", "このページでは、発掘LABが蓄積している価格推移データをもとに、FANZAセールの傾向とパターンを整理します。「価格履歴グラフで最安値を確認してから購入する」という賢い買い方もあわせて紹介します。"],
    sections: [
      { title: "FANZAセールの主な種類", paragraphs: ["セールには開催頻度や対象作品の傾向があります。割引率だけでなく、対象作品と過去価格を合わせて確認することが重要です。"], points: ["10円セール：対象作品は限られるが、知名度の高い作品が含まれることもある", "50%OFFセール（半額セール）：最も頻度が高く、数日から1週間程度開催される", "30〜40%OFFセール：新作・人気作を中心に開催されることが多い", "キャンペーンセール：年末年始や大型イベントに合わせて開催される"] },
      { title: "データから見えるセールの傾向", paragraphs: ["発掘LABに蓄積された価格履歴データから、次のような傾向を確認できます。"], points: ["月末〜月初にセールが集中する傾向", "リリースから3〜6ヶ月後に初回セールに入ることが多い", "一度セールに入った作品は繰り返しセールに入る", "10円セールは作品ごとに最大1〜2回程度"] },
      { title: "価格推移グラフで「今が最安値か」を確認する", paragraphs: ["作品詳細ページでは、過去の最安値・セール頻度・現在の価格位置を確認できます。現在価格が過去最安と一致しているか、セール頻度が高い作品かを見て判断してください。"], points: ["グラフが急落しているポイントは過去のセール時期", "現在の価格が過去最安に近ければ買い時", "再セールが続いている場合は次のセールを待つ"] },
    ],
    faq: [{ question: "セールはいつ開催されますか？", answer: "開催時期や対象作品は変動します。現在開催中のセールと価格履歴を確認し、購入直前に公式ページの条件も確認してください。" }, { question: "過去最安なら必ず買い時ですか？", answer: "価格面では有力ですが、作品内容や視聴条件との一致も重要です。過去最安だけで購入を決めないでください。" }],
    related: [{ href: "/guides/fanza-live-chat", label: "FANZAライブチャットとは？" }, { href: "/guides/fanza-registration", label: "FANZAの登録方法を見る" }, { href: "/sale", label: "今日のFANZAセール情報を見る" }],
    topLinks: [{ href: "/sale", label: "今日のセール作品を見る" }, { href: "/ranking", label: "人気作品ランキングを見る" }],
    cta: { label: "ライブチャットを確認する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Flivechat.dmm.co.jp%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", eyebrow: "PR", title: "セール待ちの間に別の楽しみ方も確認", body: "動画の値下げを待つ間、無料エリアから試せるライブチャットも選択肢になります。" },
  },
  {
    slug: "fanza-registration",
    eyebrow: "広告・PR",
    title: "FANZAの登録方法・始め方【手順を解説】",
    description: "FANZA（旧DMM.R18）の会員登録手順をわかりやすく解説。無料登録からコンテンツ購入まですべての流れを紹介します。",
    summary: "FANZA（旧DMM.R18）を利用するには、DMMアカウントの無料会員登録が必要です。メールアドレスのほか、Google・LINE・Xのアカウントを使った登録にも対応しています。",
    intro: ["FANZA（旧DMM.R18）は、DMMアカウントで利用するサービスです。会員登録は無料で、メールアドレスで登録する場合は認証コードを使って手続きを進めます。", "このページでは、初めてFANZAを使う方向けに、登録から最初のコンテンツ購入・再生までの流れをステップごとに解説します。サービスや決済の最新条件は、登録前に公式案内で確認してください。"],
    sections: [
      { title: "登録に必要なもの", paragraphs: ["メールアドレスで登録する場合は、受信できるメールアドレスとパスワードを用意します。クレジットカードは購入時に必要ですが、会員登録だけなら不要です。"], points: ["メールアドレス：認証コードを受信できるもの", "パスワード：メールアドレス登録時に設定するもの", "年齢・本人確認：成人向けサービスの利用時に、決済方法などに応じて確認が必要"] },
      { title: "登録手順（ステップ別）", paragraphs: [] },
      { title: "よくある質問", paragraphs: ["登録は無料で、会員登録だけで料金が発生することはありません。購入時には作品代金などが発生します。", "退会はDMMアカウント情報から手続きします。退会するとDMM.com・DMM GAMES・FANZA・FANZA GAMESなど、DMMアカウントで利用しているサービスがすべて利用できなくなり、元に戻せません。"] },
    ],
    faq: [{ question: "登録は本当に無料ですか？", answer: "はい、会員登録自体は無料です。コンテンツを購入する際に料金が発生します。" }, { question: "本名や住所は必要ですか？", answer: "メールアドレスで登録できます。クレジットカードで購入する際は決済情報の入力が必要です。" }, { question: "スマートフォンでも利用できますか？", answer: "はい、iOS・Androidの推奨ブラウザから利用できます。推奨環境は公式ヘルプで確認してください。" }, { question: "退会するとどうなりますか？", answer: "DMMアカウントを退会すると、FANZAを含むDMMアカウント利用サービスがすべて利用できなくなり、元に戻せません。" }],
    related: [{ href: "/guides/fanza-sale-timing", label: "FANZAのセールはいつ？" }, { href: "/guides/fanza-live-chat", label: "FANZAライブチャットとは？" }, { href: "/sale", label: "今日のFANZAセール情報を見る" }],
    inlineCta: { label: "無料登録ページを開く", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F%3Fvia%3Dvideo_top&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", body: "登録ページを開いておくと、下の手順を見ながら進められます。" },
    steps: [
      { sectionTitle: "登録手順（ステップ別）", title: "1 FANZAの公式サイトにアクセス", body: "ブラウザでFANZA公式サイトにアクセスします。トップページの「無料会員登録」または「今すぐ無料登録」ボタンをクリックします。" },
      { sectionTitle: "登録手順（ステップ別）", title: "2 メールアドレス登録を選ぶ", body: "会員登録ページで「メールアドレス」を選び、会員規約を確認して同意します。Google・LINE・Xのアカウントを使って登録する方法もあります。" },
      { sectionTitle: "登録手順（ステップ別）", title: "3 メールアドレスとパスワードを入力", body: "登録するメールアドレスとパスワードを入力し、「認証メールを送信する」を押します。このメールアドレスがDMMアカウントのログインIDになります。" },
      { sectionTitle: "登録手順（ステップ別）", title: "4 6桁の認証コードを入力", body: "入力したメールアドレスに6桁の認証コードが届きます。コードを入力すると無料会員登録が完了します。メールにURLが記載されている場合は、そのURLから登録を完了します。" },
      { sectionTitle: "登録手順（ステップ別）", title: "5 年齢・本人確認を確認する", body: "FANZAは成人作品を取り扱うため、18歳未満は利用できません。クレジットカード以外の決済手段を使う場合は、公的書類による年齢確認が必要になる場合があります。" },
      { sectionTitle: "登録手順（ステップ別）", title: "6 動画を購入・再生する", body: "登録後は作品を検索・購入できるようになります。価格推移グラフで今が最安値か確認してから、公式の商品ページで販売条件を確認して購入してください。" },
    ],
    cta: { label: "FANZAに無料登録する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F%3Fvia%3Dvideo_top&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", eyebrow: "PR", title: "今すぐFANZAに無料登録する", body: "登録は無料です。クーポンの有無や適用条件は、遷移先の公式ページで確認してください。" },
  },
  {
    slug: "fanza-subscription-guide",
    eyebrow: "見放題 GUIDE",
    title: "FANZAの見放題サービスを比較｜FANZA TV・月額動画の選び方",
    description: "FANZA TV、FANZA TV Plus、月額動画の違いを整理し、料金・作品ジャンル・視聴方法から自分に合う見放題サービスを選ぶ方法を解説します。",
    summary: "FANZAの見放題には、DMMプレミアムで利用するFANZA TV、追加サービスのFANZA TV Plus、チャンネルごとに契約するFANZA月額動画があります。名前が似ていても仕組みが違うため、目的別に比較します。",
    intro: ["FANZAの見放題サービスは、ひとつの料金プランにまとまっているわけではありません。DMMプレミアムに付属するFANZA TVと、メーカー・ジャンル別のFANZA月額動画は別サービスです。", "このページでは、契約前に確認したい料金、対象範囲、視聴期限、解約条件を整理します。料金や配信内容は変わるため、最終的な条件は各公式ページで確認してください。"],
    sections: [
      { title: "FANZAの見放題は3系統", paragraphs: ["FANZA TVはDMMプレミアムに登録すると利用できるサービスです。FANZA TV PlusはFANZA TVとは別の追加サービスで、DMMプレミアムへの登録も必要です。FANZA月額動画は、チャンネルごとに作品をまとめたサブスクリプションです。"], points: ["FANZA TV：DMMプレミアムに付属する見放題", "FANZA TV Plus：FANZA TVの追加サービス", "FANZA月額動画：見放題ch、見放題ch デラックス、VRchなどのチャンネル型サービス"] },
      { title: "サービスごとの特徴", paragraphs: ["料金だけでなく、見たいジャンルと作品の探し方で選ぶと比較しやすくなります。DMMプレミアムのFANZA TVと、特定ジャンルを深く見る月額動画では向いている人が異なります。"], points: ["幅広く安く試したい：FANZA TV", "FANZA TVをさらに楽しみたい：FANZA TV Plus", "一般的な動画や複数ジャンルを見たい：見放題ch", "作品数を最優先したい：見放題ch デラックス", "VR作品を中心に見たい：VRch"] },
      { title: "契約前に確認すること", paragraphs: ["月額サービスは入会時と更新時に決済されるため、無料期間・更新日・解約方法を確認してから登録します。見放題対象でも配信終了や対象外作品があるため、目当ての作品が含まれるか公式ページで確認してください。", "FANZA TV内の動画はDMMプレミアム会員期間中に視聴できます。単品購入とは視聴条件が異なるため、長く残したい作品は購入方式も比較します。"], points: ["月額料金と無料体験の条件", "見放題対象作品と配信終了の有無", "視聴できる端末・アプリ", "自動更新日と解約後の視聴条件"] },
    ],
    faq: [{ question: "FANZA TVとFANZA月額動画は同じですか？", answer: "別サービスです。FANZA TVはDMMプレミアムに登録すると利用でき、FANZA月額動画はチャンネルごとに契約します。" }, { question: "FANZA TV Plusだけ登録できますか？", answer: "FANZA TV Plusの利用にはDMMプレミアムへの登録も必要です。登録先の公式ページで最新条件を確認してください。" }, { question: "見放題なら作品はずっと見られますか？", answer: "サービスや作品によって配信条件が異なります。FANZA TVはDMMプレミアム登録期間中の視聴となるため、単品購入とは異なります。" }],
    related: [{ href: "/guides/fanza-registration", label: "FANZAの登録方法を見る" }, { href: "/guides/fanza-sale-timing", label: "FANZAのセールはいつ？" }, { href: "/sale", label: "今日のFANZAセール情報を見る" }],
    serviceLinks: [
      { label: "FANZA TV・FANZA TV Plusを確認する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fpremium.fanza.jp%2Fnotice%2Ffanzatv_plus_welcome%2F&af_id=koichi1928-026&ch=link_tool&ch_id=link" },
      { label: "FANZA月額動画トップを見る", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link" },
      { label: "見放題chを見る", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2Fstandard%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link" },
      { label: "見放題ch デラックスを見る", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2Fdeluxe%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link" },
      { label: "VRchを見る", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2Fvr%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link" },
    ],
    cta: { label: "見放題サービスを公式ページで確認する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", eyebrow: "PR", title: "自分に合う見放題サービスを確認", body: "料金・対象作品・無料体験・更新条件は、登録前に公式ページで確認してください。" },
  },
  {
    slug: "fanza-vr-guide",
    eyebrow: "VR GUIDE",
    title: "FANZA VRの始め方｜VR動画とVRchの違い・対応機器を解説",
    description: "FANZA VR動画の単品購入とVRch（月額VR）の違い、対応機器、ストリーミング・ダウンロード再生の選び方を解説します。",
    summary: "FANZA VRには、作品ごとに購入するVR動画と、月額固定料金で対象作品を見るVRchがあります。視聴機器や再生方法も通常動画と異なるため、購入・登録前に確認しましょう。",
    intro: ["FANZA VR動画は、通常の2D動画とは異なる視聴環境が必要です。スマートフォン、Meta Quest、PICO、PlayStation VRなど、機器によって利用できるアプリや再生方法が異なります。", "また、VR動画を作品ごとに購入する方法と、VRch（月額VR）で対象作品を見放題にする方法は別サービスです。見たい作品と利用頻度に合わせて選びます。"],
    sections: [
      { title: "FANZA VR動画とVRchの違い", paragraphs: ["VR動画は、FANZA VR動画フロアから作品を1本ずつ購入して視聴します。VRchは対象作品を月額固定料金で視聴するサービスです。コンテンツ自体は共通する場合がありますが、VRchには最新作など一部対象外の作品があります。"], points: ["VR動画：作品単位で購入して視聴", "VRch（月額VR）：対象作品を月額固定料金で視聴", "VRchは通常の2D動画を含まない", "VRchで再生できる最大画質はHQ画質"] },
      { title: "対応機器と再生方法", paragraphs: ["対応機器には専用のVR動画プレイヤーやアプリを利用します。ストリーミングとダウンロードの両方に対応する機器がありますが、PlayStation VR・VR2はストリーミング再生のみ対応です。"], points: ["Meta Quest 3・3S・2・Pro：専用アプリで再生", "PICO 4・4 Ultra：専用アプリで再生", "iPhone・iPad・Android：DMM VR動画プレイヤーを利用", "PlayStation VR・VR2：ストリーミング再生に対応", "Oculus Rift系・HTC VIVE系：PC用プレイヤーを利用"] },
      { title: "購入・登録前に確認すること", paragraphs: ["まず、利用する機器が対応しているかを公式ヘルプで確認します。次に、目当ての作品がVRchの対象か、必要な画質に対応しているかを確認してください。", "VR動画は大容量になる場合があるため、ダウンロード再生では保存容量とダウンロード時間も確認します。PCとVR機器を接続して再生する方法など、一部の構成は公式サポート対象外の場合があります。"], points: ["対応機器と専用アプリ", "ストリーミング／ダウンロードの可否", "VRchの対象作品かどうか", "画質・保存容量・通信環境", "購入前のサンプルと作品詳細"] },
    ],
    faq: [{ question: "FANZA TVやFANZA TV PlusでVR動画を見られますか？", answer: "FANZA TV・FANZA TV PlusではVR動画は配信されていません。VR動画はFANZA VR動画またはVRchを確認してください。" }, { question: "VRchなら最新のVR動画も見放題ですか？", answer: "最新作を含む一部VR動画はVRchの対象外です。登録前に対象作品を公式ページで確認してください。" }, { question: "スマートフォンだけでVR動画を見られますか？", answer: "対応するスマートフォンとDMM VR動画プレイヤーで再生できます。作品や機器によって対応条件が異なるため、公式の動作環境を確認してください。" }],
    related: [{ href: "/guides/fanza-subscription-guide", label: "FANZAの見放題サービスを比較する" }, { href: "/guides/fanza-registration", label: "FANZAの登録方法を見る" }, { href: "/sale", label: "今日のFANZAセール情報を見る" }],
    internalLinks: [{ label: "発掘LABのFANZA VRランキングを見る", href: "/vr" }],
    serviceLinks: [{ label: "VRch（月額VR）を公式ページで確認する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2Fvr%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link" }],
    cta: { label: "VRch（月額VR）を確認する", href: "https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fsvod%2Fvr%2F&af_id=koichi1928-026&ch=toolbar_sp&ch_id=link", eyebrow: "PR", title: "VR作品を月額で楽しむ", body: "VRchの対象作品・料金・視聴条件は、登録前に公式ページで確認してください。" },
  },
];

export function getAnalyzerGuide(slug: string) {
  return analyzerGuideArticles.find((guide) => guide.slug === slug);
}
