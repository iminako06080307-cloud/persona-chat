import type { PostStore } from "../types";
import { SheetsPostStore } from "./sheets";
import { MemoryPostStore } from "./memory";

export { SheetsPostStore, MemoryPostStore };

/**
 * 環境変数 POST_STORE に応じてストアを返します。
 * - "sheets"（既定）: Google スプレッドシート
 * - "memory": メモリ（テスト用。topics は環境変数 TOPICS をカンマ区切りで）
 */
export function getStore(): PostStore {
  const kind = process.env.POST_STORE ?? "sheets";
  if (kind === "memory") {
    const topics = (process.env.TOPICS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return new MemoryPostStore(topics);
  }
  if (kind === "sheets") return new SheetsPostStore();
  throw new Error(`POST_STORE の値が不正です: ${kind}`);
}
