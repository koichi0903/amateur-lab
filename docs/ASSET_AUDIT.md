# 発掘LAB Asset Audit

Version: 1.0
Status: Active
Last Updated: 2026-07-06

---

# 概要

このドキュメントは、発掘LABが現在保有している資産（ページ・コンポーネント・API・DB・SEOなど）を一覧管理するための監査資料です。

目的は以下の3点です。

- 現在ある機能を把握する
- 重複実装を防ぐ
- 今後の改善点を整理する

---

# 1. Pages

| ページ | 状態 | 備考 |
|---------|------|------|
| TOP | ✅ | |
| ランキング | ✅ | |
| 検索 | ✅ | |
| 新着 | ✅ | |
| 作品詳細 | ✅ | |
| 女優一覧 | ✅ | |
| 女優詳細 | ✅ | |
| ジャンル一覧 | ✅ | |
| ジャンル詳細 | ✅ | |
| メーカー一覧 | ✅ | |
| メーカー詳細 | ✅ | |
| シリーズ一覧 | ✅ | |
| シリーズ詳細 | ✅ | |
| 管理画面 | ✅ | |

---

# 2. Components

| コンポーネント | 状態 | 備考 |
|---------------|------|------|
| WorkCard | 🟡 | 最終仕様見直し予定 |
| WorkHero | ✅ | |
| WorkInfo | ✅ | |
| ScoreBar | ✅ | |
| MiniBar | ✅ | |
| AIAnalysis | ✅ | |
| Breadcrumb | ✅ | |
| RelatedWorks | ✅ | |

---

# 3. API / Batch

| 機能 | 状態 | 備考 |
|------|------|------|
| DMM API取得 | ✅ | |
| ランキング更新 | ✅ | |
| Statistics更新 | ✅ | |
| Score更新 | ✅ | |

---

# 4. Database

| テーブル | 状態 | 備考 |
|----------|------|------|
| works | ✅ | |
| actress_rankings | ✅ | |
| genre_rankings | ✅ | |
| maker_rankings | ✅ | |
| series_rankings | ✅ | |
| site_statistics | ✅ | |

---

# 5. SEO

| 項目 | 状態 | 備考 |
|------|------|------|
| Metadata | ✅ | |
| Open Graph | ✅ | |
| Twitter Card | ✅ | |
| favicon | ✅ | |
| robots.txt | ✅ | |
| sitemap.xml | ✅ | Search Console反映待ち |
| JSON-LD | ✅ | |

---

# 6. Infrastructure

| 項目 | 状態 |
|------|------|
| Next.js | ✅ |
| TypeScript | ✅ |
| Tailwind CSS | ✅ |
| Supabase | ✅ |
| Vercel | ✅ |
| DMM API | ✅ |

---

# 今後追加予定

- WorkCard最終仕様
- セール情報取得（Web）
- 類似作品
- 人気ランキング強化
- AI分析強化

---

# 更新ルール

このファイルは、新しいページ・コンポーネント・API・DBを追加したときに更新する。

調査だけでは更新しない。
資産が増えた・変更された場合のみ更新する。