import type { PostStore } from "./types";
import { generatePosts } from "./generate";

/**
 * topics タブからまだ下書きが無いお題を選び、下書きを生成してストアに追加します。
 * 生成スクリプトと Cron ルートの両方から使います。
 */
export interface CreateDraftsOptions {
  store: PostStore;
  /** 何件のお題を処理するか（既定 2） */
  count?: number;
  log?: (msg: string) => void;
}

export interface CreateDraftsResult {
  topics: string[];
  created: number;
}

export async function createDrafts(opts: CreateDraftsOptions): Promise<CreateDraftsResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const count = opts.count ?? 2;

  const topics = await opts.store.listTopics();
  if (topics.length === 0) {
    log("topics タブにお題がありません。1行1お題で追加してください。");
    return { topics: [], created: 0 };
  }

  // 既に何らかの投稿（下書き〜投稿済み）があるお題は除外
  const used = new Set<string>();
  for (const status of ["draft", "approved", "published", "failed"] as const) {
    for (const p of await opts.store.listByStatus(status)) used.add(p.topic.trim());
  }
  const fresh = topics.filter((t) => !used.has(t.trim()));
  if (fresh.length === 0) {
    log("未使用のお題がありません。topics タブに新しいお題を追加してください。");
    return { topics: [], created: 0 };
  }

  const picked = fresh.slice(0, count);
  log(`お題 ${picked.length} 件で下書きを生成します: ${picked.join(" / ")}`);

  const drafts = await generatePosts({ topics: picked });
  await opts.store.addDrafts(drafts);
  log(`下書き ${drafts.length} 件を追加しました。シートで内容を確認し、status を approved にしてください。`);

  return { topics: picked, created: drafts.length };
}
