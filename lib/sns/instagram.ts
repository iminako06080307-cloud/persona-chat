import { graphFetch, sleep } from "./client";
import type { Post, Publisher } from "./types";

/**
 * Instagram Graph API（コンテンツ公開）。
 * 1. /{ig-user-id}/media でコンテナ作成（image_url + caption）
 * 2. コンテナの status_code が FINISHED になるまで待つ
 * 3. /{ig-user-id}/media_publish で公開
 *
 * 必要条件：Instagram プロアカウント + Facebook ページ連携、長期アクセストークン、
 * 画像は公開 URL の JPEG。
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export interface InstagramConfig {
  userId: string;
  token: string;
  /** コンテナ処理待ちの最大試行回数（既定 10 回 × 2 秒） */
  maxPolls?: number;
  pollIntervalMs?: number;
}

export function instagramConfigFromEnv(): InstagramConfig {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) {
    throw new Error("IG_USER_ID / IG_ACCESS_TOKEN が設定されていません。");
  }
  return { userId, token };
}

export class InstagramPublisher implements Publisher {
  constructor(private cfg: InstagramConfig) {}

  async publish(post: Post): Promise<{ postId: string }> {
    if (!post.imageUrl) {
      throw new Error("Instagram 投稿には imageUrl（公開 URL の JPEG 画像）が必要です。");
    }
    const { userId, token } = this.cfg;

    const container = await graphFetch<{ id: string }>(GRAPH_BASE, `/${userId}/media`, {
      method: "POST",
      token,
      params: { image_url: post.imageUrl, caption: post.text },
    });

    const maxPolls = this.cfg.maxPolls ?? 10;
    const interval = this.cfg.pollIntervalMs ?? 2000;
    for (let i = 0; i < maxPolls; i++) {
      const st = await graphFetch<{ status_code?: string; status?: string }>(
        GRAPH_BASE,
        `/${container.id}`,
        { token, params: { fields: "status_code,status" } }
      );
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        throw new Error(`Instagram コンテナの処理に失敗しました: ${st.status ?? st.status_code}`);
      }
      await sleep(interval);
    }

    const published = await graphFetch<{ id: string }>(
      GRAPH_BASE,
      `/${userId}/media_publish`,
      { method: "POST", token, params: { creation_id: container.id } }
    );
    return { postId: published.id };
  }
}
