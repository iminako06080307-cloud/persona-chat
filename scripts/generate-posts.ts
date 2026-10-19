/**
 * ローカルで投稿の下書きを生成するスクリプト。
 *   npm run generate            # お題 2 件分
 *   npm run generate -- 5       # お題 5 件分
 */
import "dotenv/config";
import { config } from "dotenv";
import { getStore } from "../lib/sns/store";
import { createDrafts } from "../lib/sns/drafts";

config({ path: ".env.local", override: false });

async function main() {
  const count = Number(process.argv[2] ?? 2);
  const store = getStore();
  const result = await createDrafts({ store, count });
  if (process.env.POST_STORE === "memory" && "all" in store) {
    console.log(JSON.stringify((store as { all(): unknown }).all(), null, 2));
  }
  console.log(`完了: お題 ${result.topics.length} 件 / 下書き ${result.created} 件`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
