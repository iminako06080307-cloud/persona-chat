import type { NewDraft, Post, PostStatus, PostStore } from "../types";

/**
 * メモリ上だけで動く PostStore。テストやドライランで使います。
 */
export class MemoryPostStore implements PostStore {
  private posts: Post[] = [];

  constructor(private topics: string[] = [], seed: Post[] = []) {
    this.posts = [...seed];
  }

  async listByStatus(status: PostStatus): Promise<Post[]> {
    return this.posts.filter((p) => p.status === status);
  }

  async addDrafts(drafts: NewDraft[]): Promise<void> {
    const now = new Date().toISOString();
    for (const d of drafts) {
      this.posts.push({ ...d, status: "draft", createdAt: now });
    }
  }

  async update(id: string, patch: Partial<Post>): Promise<void> {
    const p = this.posts.find((x) => x.id === id);
    if (!p) throw new Error(`投稿が見つかりません: ${id}`);
    Object.assign(p, patch);
  }

  async listTopics(): Promise<string[]> {
    return [...this.topics];
  }

  /** テスト用：全件を返す */
  all(): Post[] {
    return [...this.posts];
  }
}
