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
