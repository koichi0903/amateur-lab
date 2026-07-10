1. 発掘LABの思想
必要な作品だけ取得する

必要なタイミングだけ更新する

取得回数を最小化する

価格と作品情報の責務を完全分離する
2. システム構成
   - DMM API
   - Playwright

   DMM API
新規作品登録
作品情報取得
（将来）レビュー更新

価格取得は禁止。

3. 更新フロー
   3-1 ステージ判定
   3-2 新規作品登録
   3-3 初回価格登録
   3-4 自動価格更新
   3-5 セール更新
   3-6 手動更新
   ここがVer2最大の追加です。

新作一覧

↓

NEW

↓

SEMI_NEW

↓

OLD

↓

SALE（別管理）

ここで

stage

を正式採用します。

4. stage
   NEW
   SEMI_NEW
   OLD
   ステージ判定

↓

stage更新

↓

更新対象決定

↓

価格更新

5. is_on_sale
is_on_sale

独立管理。
6. next_price_update_at（将来）
Playwright

↓

新規作品発見

↓

DMM API

↓

works

↓

Playwright価格登録
7. 更新スケジュール

現状

stage

管理。

将来

next_price_update_at

導入予定。

8. 管理画面

管理者のみ

価格更新

ボタン。

一般公開ページは禁止。

9. 開発ルール
今回決めた

Ver2完成まで設計変更禁止

もここへ追記します。