/**
 * SNS 自動投稿の共通型。
 *
 * 投稿は「下書き(draft) → 承認(approved) → 投稿済み(published) / 失敗(failed)」の
 * 状態を持ち、承認はスプレッドシート上で人が行います。
 */

export type Platform = "instagram" | "threads";

export type PostStatus = "draft" | "approved" | "published" | "failed";

export const PLATFORMS: Platform[] = ["threads", "instagram"];

export interface Post {
  /** 行を特定するための UUID（行番号には依存しない） */
  id: string;
  platform: Platform;
  /** 生成元のトピック（topics タブの1行） */
  topic: string;
  /** 投稿本文（Threads はテキスト、Instagram はキャプション） */
  text: string;
  /** Instagram のみ必須。公開 URL の JPEG 画像 */
  imageUrl?: string;
  status: PostStatus;
  createdAt: string;
  approvedAt?: string;
  publishedAt?: string;
  /** 投稿後に Meta から返る投稿 ID */
  postId?: string;
  /** 失敗時のエラー内容 */
  error?: string;
}

export type NewDraft = Omit<Post, "status" | "createdAt">;

export interface PostStore {
  listByStatus(status: PostStatus): Promise<Post[]>;
  addDrafts(posts: NewDraft[]): Promise<void>;
  update(id: string, patch: Partial<Post>): Promise<void>;
  listTopics(): Promise<string[]>;
}

export interface Publisher {
  publish(post: Post): Promise<{ postId: string }>;
}

/** Threads のテキスト投稿の上限文字数 */
export const THREADS_MAX_CHARS = 500;
/** Instagram キャプションの上限文字数（API 上限は 2200） */
export const INSTAGRAM_MAX_CHARS = 2200;
