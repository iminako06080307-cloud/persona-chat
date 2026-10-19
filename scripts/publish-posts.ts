/**
 * ローカルで承認済み投稿を公開するスクリプト（Cron と同じ処理）。
 *   DRY_RUN=1 npm run publish-posts   # 投稿せずに内容だけ表示
 *   npm run publish-posts             # 実際に投稿
 */
import "dotenv/config";
import { config } from "dotenv";
import { getStore } from "../lib/sns/store";
import { publishApproved } from "../lib/sns/publish";

config({ path: ".env.local", override: false });

async function main() {
  const result = await publishApproved({ store: getStore() });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
