# デプロイ手順（Vercelで公開URLにする）

スマホでそのまま開ける公開URLを、Vercel（無料枠あり）で作ります。パソコンでの作業は10〜15分程度です。APIキーはVercelの環境変数に保存するので、画面やコードには出ません。

## 事前に用意するもの

1. **Anthropic の APIキー**
   - https://console.anthropic.com/ にログイン →「API Keys」→「Create Key」
   - `sk-ant-...` で始まる文字列をコピーしておく（あとで貼り付けます）
   - ※ 従量課金です。まずは少額（例：$5〜）のクレジットで十分試せます。
2. **GitHub アカウント**（このコードが置いてあるアカウント）

## 手順

### 1. Vercel にログイン
- https://vercel.com/ を開き、「**Continue with GitHub**」でログイン（無料の Hobby プランでOK）。

### 2. プロジェクトを取り込む
- ダッシュボードで「**Add New…**」→「**Project**」。
- リポジトリ一覧から `persona-chat` を選び「**Import**」。
  - 一覧に出ないときは「Adjust GitHub App Permissions」からこのリポジトリへのアクセスを許可してください。

### 3. 環境変数（APIキー）を設定
「Configure Project」画面の「**Environment Variables**」で、以下を追加します。

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | さきほどコピーした `sk-ant-...` |

- （任意）モデルを変えたい場合のみ `ANTHROPIC_MODEL` に `claude-opus-4-8` などを設定。未設定なら自動で `claude-opus-4-8` を使います。
- フレームワークは自動で「Next.js」と認識されます。ビルド設定はそのままでOKです。

### 4. デプロイするブランチを指定
現在このアプリのコードは `claude/persona-chat-integration-b9ylc1` ブランチにあります。

- **かんたんな方法**：Import 時の「Branch」で `claude/persona-chat-integration-b9ylc1` を選ぶ（または、デプロイ後に **Settings → Git → Production Branch** をこのブランチに変更）。
- ※ 将来 `main` に統合したい場合は、その旨お伝えください。プルリクエスト作成のお手伝いをします。

### 5. デプロイ
- 「**Deploy**」を押す → 1〜2分で完了。
- 表示された `https://persona-chat-xxxx.vercel.app` のようなURLがあなたのアプリです。スマホのブラウザで開けば、その場で食事写真を送ってフィードバックを試せます📷

## うまくいかないときは

- **「ANTHROPIC_API_KEY が設定されていません」と出る**
  → 環境変数の名前が正確に `ANTHROPIC_API_KEY` になっているか確認。変更したら **Deployments → 最新 → Redeploy** で反映されます。
- **返信が来ない／エラーになる**
  → APIキーの残高（クレジット）が残っているか、キーが有効かを Anthropic のコンソールで確認してください。
- **写真を送るとエラー**
  → 送信前にアプリ側で自動縮小していますが、極端に大きい・特殊な形式（HEIC等）の場合は、一度スクリーンショットにする等で回避できます。

## 会員さんへの共有について

公開URLは、URLを知っている人なら誰でも開けます。特定の会員さんだけに使ってもらいたい場合は、次のような対策を追加できます（ご希望あれば実装します）。

- 合言葉（パスコード）での簡易ログイン
- 会員ごとのアカウント管理・利用履歴の保存
- 送信画像の取り扱いに関する同意画面

まずは公開URLで動きと雰囲気を確認し、そのうえで必要な機能を足していくのがおすすめです。

---

# SNS自動投稿の設定（Instagram / Threads）

みきさんの口調で投稿の下書きを AI が作り、**スプレッドシートで確認・承認したものだけ**が自動で投稿される仕組みです。初回の設定はパソコンで 1〜2 時間ほどかかりますが、設定後の日々の作業はスプレッドシートを見るだけです。

## 全体の流れ

1. `topics` タブに投稿のお題を書いておく（例：「停滞期の乗り越え方」「夜ご飯の主食の量」）
2. 毎晩、AI がお題ごとに Threads 用と Instagram 用の下書きを `posts` タブに追加する（`status` は `draft`）
3. 下書きを読んで、必要なら文章を直し、Instagram の行には画像の URL を貼る
4. 投稿して良いものは `status` を **`approved`** に書き換える
5. 翌日の決まった時間に、`approved` の行が投稿され、`status` が `published` になる（失敗したら `failed` と理由が `error` 列に入る）

1 回の実行で投稿されるのは **Threads 1 件 + Instagram 1 件** までです。残りは翌日に回ります。

## 1. Google スプレッドシートを用意する

1. 新しいスプレッドシートを作り、URL の `/d/` と `/edit` の間の文字列（シート ID）を控える。
2. タブは作らなくて大丈夫です（初回アクセス時に `posts` と `topics` が自動で作られます）。先に作る場合は `topics` タブの A 列に 1 行 1 お題で書いてください。
3. **サービスアカウント**を作る：
   - https://console.cloud.google.com/ で新しいプロジェクトを作成
   - 「API とサービス」→「ライブラリ」で **Google Sheets API** を有効化
   - 「認証情報」→「認証情報を作成」→「サービスアカウント」→ 作成後、「キー」タブで **JSON** のキーを追加してダウンロード
   - JSON の `client_email` が `GOOGLE_SERVICE_ACCOUNT_EMAIL`、`private_key` が `GOOGLE_PRIVATE_KEY`
4. スプレッドシートの「共有」で、サービスアカウントのメールアドレスを**編集者**として追加する。

## 2. Meta（Instagram / Threads）のアプリを作る

アプリは「開発モード」のままで大丈夫です。**自分のアカウントに投稿するだけなら Meta の審査は不要**です。

1. https://developers.facebook.com/ にログインし「アプリを作成」→ 用途は「ビジネス」。
2. アプリに **Instagram** と **Threads API** の製品を追加する。
3. **Instagram の準備**
   - Instagram アカウントを「プロアカウント（ビジネス／クリエイター）」に切り替える。
   - Facebook ページを作り、Instagram アカウントと連携する（Instagram の設定 →「アカウントセンター」）。
   - アプリの「アプリの役割」→「ロール」で、自分の Instagram アカウントを **Instagram テスター** に追加し、Instagram 側で招待を承認する。
   - 「ツール」→「グラフ API エクスプローラ」で権限 `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` を付けてトークンを取得し、**長期トークン**に交換する（`GET /oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=短期トークン`）。これが `IG_ACCESS_TOKEN`。
   - `GET /me/accounts` でページ ID を調べ、`GET /{ページID}?fields=instagram_business_account` で出てくる `id` が `IG_USER_ID`。
4. **Threads の準備**
   - アプリの「アプリの役割」→「ロール」で、自分の Threads アカウントを **Threads テスター** に追加し、Threads アプリの「設定」→「ウェブサイトのアクセス許可」で招待を承認する。
   - Threads API の「ユースケース」→「設定」で権限 `threads_basic`, `threads_content_publish` を付けてトークンを取得し、長期トークンに交換する（`GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=...&access_token=短期トークン`）。これが `THREADS_ACCESS_TOKEN`。
   - `GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=...` の `id` が `THREADS_USER_ID`。

> **トークンの期限について**：長期トークンは Instagram・Threads とも **約 60 日**で切れます。切れると投稿が `failed` になり、`error` 列にその旨が出ます。**50 日ごとにカレンダーにリマインドを入れて**、上の手順でトークンを取り直し、Vercel の環境変数を更新してください。

## 3. Instagram の画像について

Instagram の API は「インターネット上で誰でも開ける JPEG 画像の URL」しか受け付けません。Google ドライブの共有リンクや LINE の画像は使えません。おすすめは次のどちらかです。

- Vercel の **Blob** ストレージにアップロードし、その URL を貼る
- 画像ホスティング（Imgur、Cloudinary など）にアップロードし、「画像そのものの URL（末尾が `.jpg`）」を貼る

`posts` タブの Instagram 行の `imageUrl` 列に貼ってから `approved` にしてください。画像が無い行は投稿されず、`error` 列に理由が書かれます。

## 4. Vercel に環境変数を追加する

Vercel の **Settings → Environment Variables** に以下を追加して、**Redeploy** してください。

| Name | Value |
|---|---|
| `CRON_SECRET` | 長いランダムな文字列（例：パスワード生成ツールで 32 文字以上） |
| `GOOGLE_SHEET_ID` | スプレッドシートの ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントのメールアドレス |
| `GOOGLE_PRIVATE_KEY` | JSON キーの `private_key` の値をそのまま（`\n` を含めて 1 行で貼って OK） |
| `IG_USER_ID` / `IG_ACCESS_TOKEN` | Instagram の ID と長期トークン |
| `THREADS_USER_ID` / `THREADS_ACCESS_TOKEN` | Threads の ID と長期トークン |

スケジュールは `vercel.json` に書いてあります（Vercel の無料プランでは 1 日 1 回まで。実行時刻は多少ずれます）。

- 下書き生成：毎日 22:00 UTC（日本時間 翌 7:00 ごろ）
- 投稿：毎日 10:00 UTC（日本時間 19:00 ごろ）

時刻を変えたい場合は `vercel.json` の `schedule` を変更します。Vercel の **Settings → Cron Jobs** で、ジョブの一覧と「Run」ボタン（手動実行）とログが見られます。

## 5. 動作確認（まずは投稿せずに）

パソコンで `.env.local` に上の値を入れたうえで：

```bash
# 下書きを 1 お題分だけ作ってシートに入れる
npm run generate -- 1

# シートで 1 行を approved にしてから、投稿せずに内容だけ確認
DRY_RUN=1 npm run publish-posts

# 実際に投稿する（テスト用アカウントで）
npm run publish-posts
```

公開後の Vercel 上で確認する場合：

```bash
curl -H "Authorization: Bearer <CRON_SECRET の値>" https://<あなたのアプリ>.vercel.app/api/cron/publish
```

`{"ok":true,...}` と、投稿結果（`published` / `failed` / `skipped`）が返ってきます。合言葉が違うと `401` になります。

## うまくいかないときは（SNS）

- **`failed` になり `error` に「Meta API エラー 190」** → トークンの期限切れです。手順 2 でトークンを取り直してください。
- **Instagram が `skipped` で「imageUrl が空です」** → 画像の URL を貼ってください。
- **「GOOGLE_PRIVATE_KEY が設定されていません」や認証エラー** → 秘密鍵の貼り付けが途中で切れていないか、シートをサービスアカウントに共有したかを確認。
- **下書きが増えない** → `topics` タブに未使用のお題があるか確認。同じお題は 2 回使いません。
