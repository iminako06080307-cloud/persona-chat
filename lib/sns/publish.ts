import type { Platform, Post, PostStore, Publisher } from "./types";
import { InstagramPublisher, instagramConfigFromEnv } from "./instagram";
import { ThreadsPublisher, threadsConfigFromEnv } from "./threads";

/**
 * 承認済み（approved）の投稿を公開します。
 *
 * - 1回の実行で各プラットフォーム最大 limit 件（既定 1 件）。Vercel Hobby の実行時間制限内に収めるため。
 * - Threads は公開前に待ち時間があるので先に処理し、時間予算（budgetMs）を超えたら残りは次回に回す。
 * - 成功したらすぐ status を published にするので、途中で落ちても二重投稿にならない。
 * - DRY_RUN=1 なら実際には投稿せず、ログだけ出して行は変更しない。
 */

export interface PublishOptions {
  store: PostStore;
  /** プラットフォームごとの最大件数（既定 1） */
  limitPerPlatform?: number;
  dryRun?: boolean;
  /** この実行に使える時間（ミリ秒）。既定 50 秒 */
  budgetMs?: number;
  publishers?: Partial<Record<Platform, Publisher>>;
  log?: (msg: string) => void;
}

export interface PublishResult {
  published: { id: string; platform: Platform; postId: string }[];
  failed: { id: string; platform: Platform; error: string }[];
  skipped: { id: string; platform: Platform; reason: string }[];
  dryRun: boolean;
}

function defaultPublisher(platform: Platform): Publisher {
  if (platform === "threads") return new ThreadsPublisher(threadsConfigFromEnv());
  return new InstagramPublisher(instagramConfigFromEnv());
}

export async function publishApproved(opts: PublishOptions): Promise<PublishResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const limit = opts.limitPerPlatform ?? 1;
  const dryRun = opts.dryRun ?? process.env.DRY_RUN === "1";
  const budgetMs = opts.budgetMs ?? 50_000;
  const started = Date.now();

  const result: PublishResult = { published: [], failed: [], skipped: [], dryRun };

  const approved = await opts.store.listByStatus("approved");
  // 古いものから順に。Threads を先に（待ち時間が長いため）
  const order: Platform[] = ["threads", "instagram"];
  const queue: Post[] = [];
  for (const platform of order) {
    const rows = approved
      .filter((p) => p.platform === platform)
      .sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt))
      .slice(0, limit);
    queue.push(...rows);
  }

  if (queue.length === 0) {
    log("承認済みの投稿はありません。");
    return result;
  }

  for (const post of queue) {
    if (Date.now() - started > budgetMs) {
      result.skipped.push({ id: post.id, platform: post.platform, reason: "時間切れ（次回に持ち越し）" });
      continue;
    }

    if (post.platform === "instagram" && !post.imageUrl) {
      const reason = "imageUrl が空です。公開 URL の JPEG 画像を貼ってください。";
      result.skipped.push({ id: post.id, platform: post.platform, reason });
      if (!dryRun) await opts.store.update(post.id, { error: reason });
      log(`[skip] ${post.platform} ${post.id}: ${reason}`);
      continue;
    }

    if (dryRun) {
      log(`[dry-run] ${post.platform} に投稿します（${[...post.text].length}文字）:\n${post.text}\n`);
      result.published.push({ id: post.id, platform: post.platform, postId: "dry-run" });
      continue;
    }

    try {
      const publisher = opts.publishers?.[post.platform] ?? defaultPublisher(post.platform);
      const { postId } = await publisher.publish(post);
      await opts.store.update(post.id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        postId,
        error: "",
      });
      result.published.push({ id: post.id, platform: post.platform, postId });
      log(`[ok] ${post.platform} ${post.id} -> ${postId}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await opts.store.update(post.id, { status: "failed", error });
      result.failed.push({ id: post.id, platform: post.platform, error });
      log(`[fail] ${post.platform} ${post.id}: ${error}`);
    }
  }

  return result;
}
