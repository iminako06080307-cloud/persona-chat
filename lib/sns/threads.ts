import { graphFetch, sleep } from "./client";
import type { Post, Publisher } from "./types";

/**
 * Threads API（テキスト投稿）。
 * 1. /{threads-user-id}/threads でコンテナ作成（media_type=TEXT）
 * 2. Meta は公開前に約 30 秒待つことを推奨。status を見ながら待つ
 * 3. /{threads-user-id}/threads_publish で公開
 */

const THREADS_BASE = "https://graph.threads.net/v1.0";

export interface ThreadsConfig {
  userId: string;
  token: string;
  /** 公開前の待ち時間の上限（ミリ秒）。既定 35 秒 */
  maxWaitMs?: number;
  pollIntervalMs?: number;
}

export function threadsConfigFromEnv(): ThreadsConfig {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !token) {
    throw new Error("THREADS_USER_ID / THREADS_ACCESS_TOKEN が設定されていません。");
  }
  return { userId, token };
}

export class ThreadsPublisher implements Publisher {
  constructor(private cfg: ThreadsConfig) {}

  async publish(post: Post): Promise<{ postId: string }> {
    const { userId, token } = this.cfg;

    const container = await graphFetch<{ id: string }>(THREADS_BASE, `/${userId}/threads`, {
      method: "POST",
      token,
      params: { media_type: "TEXT", text: post.text },
    });

    const maxWait = this.cfg.maxWaitMs ?? 35_000;
    const interval = this.cfg.pollIntervalMs ?? 5_000;
    const started = Date.now();
    while (Date.now() - started < maxWait) {
      const st = await graphFetch<{ status?: string; error_message?: string }>(
        THREADS_BASE,
        `/${container.id}`,
        { token, params: { fields: "status,error_message" } }
      );
      if (st.status === "FINISHED") break;
      if (st.status === "ERROR" || st.status === "EXPIRED") {
        throw new Error(`Threads コンテナの処理に失敗しました: ${st.error_message ?? st.status}`);
      }
      await sleep(interval);
    }

    const published = await graphFetch<{ id: string }>(
      THREADS_BASE,
      `/${userId}/threads_publish`,
      { method: "POST", token, params: { creation_id: container.id } }
    );
    return { postId: published.id };
  }
}

/**
 * Threads の長期トークン（約 60 日）を更新します。
 * 発行から 24 時間以上経過したトークンのみ更新できます。
 */
export async function refreshThreadsToken(token: string): Promise<{
  accessToken: string;
  expiresInSec: number;
}> {
  const res = await graphFetch<{ access_token: string; expires_in: number }>(
    THREADS_BASE,
    "/refresh_access_token",
    { token, params: { grant_type: "th_refresh_token" } }
  );
  return { accessToken: res.access_token, expiresInSec: res.expires_in };
}
