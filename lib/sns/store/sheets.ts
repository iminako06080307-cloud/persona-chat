import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import type { NewDraft, Post, PostStatus, PostStore } from "../types";

/**
 * Google スプレッドシートを承認ストアとして使う PostStore。
 *
 * - `posts` タブ：投稿の下書き〜投稿結果を1行1件で管理
 * - `topics` タブ：投稿のお題を1行1件で管理（A列のみ使用）
 *
 * シートは「サービスアカウントのメールアドレス」に編集権限で共有しておく必要があります。
 * タブとヘッダー行が無ければ初回アクセス時に自動で作成します。
 */

const POSTS_SHEET = "posts";
const TOPICS_SHEET = "topics";

const POST_HEADERS = [
  "id",
  "platform",
  "topic",
  "text",
  "imageUrl",
  "status",
  "createdAt",
  "approvedAt",
  "publishedAt",
  "postId",
  "error",
] as const;

type PostHeader = (typeof POST_HEADERS)[number];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} が設定されていません。`);
  return v;
}

export class SheetsPostStore implements PostStore {
  private doc: GoogleSpreadsheet;
  private loaded = false;

  constructor(opts?: { sheetId?: string; email?: string; privateKey?: string }) {
    const sheetId = opts?.sheetId ?? requireEnv("GOOGLE_SHEET_ID");
    const email = opts?.email ?? requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    // Vercel の環境変数では改行が "\n" の2文字で入ることがあるので戻す
    const privateKey = (opts?.privateKey ?? requireEnv("GOOGLE_PRIVATE_KEY")).replace(
      /\\n/g,
      "\n"
    );

    const auth = new JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.doc = new GoogleSpreadsheet(sheetId, auth);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.doc.loadInfo();
    this.loaded = true;
  }

  private async postsSheet(): Promise<GoogleSpreadsheetWorksheet> {
    await this.ensureLoaded();
    let sheet = this.doc.sheetsByTitle[POSTS_SHEET];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: POSTS_SHEET,
        headerValues: [...POST_HEADERS],
      });
      return sheet;
    }
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow([...POST_HEADERS]);
    }
    return sheet;
  }

  private async topicsSheet(): Promise<GoogleSpreadsheetWorksheet> {
    await this.ensureLoaded();
    let sheet = this.doc.sheetsByTitle[TOPICS_SHEET];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: TOPICS_SHEET,
        headerValues: ["topic"],
      });
    }
    return sheet;
  }

  async listByStatus(status: PostStatus): Promise<Post[]> {
    const sheet = await this.postsSheet();
    const rows = await sheet.getRows<Record<PostHeader, string>>();
    return rows
      .filter((r) => (r.get("status") ?? "").trim() === status)
      .map((r) => rowToPost(r.toObject() as Record<PostHeader, string>));
  }

  async addDrafts(drafts: NewDraft[]): Promise<void> {
    if (drafts.length === 0) return;
    const sheet = await this.postsSheet();
    const now = new Date().toISOString();
    await sheet.addRows(
      drafts.map((d) => ({
        id: d.id,
        platform: d.platform,
        topic: d.topic,
        text: d.text,
        imageUrl: d.imageUrl ?? "",
        status: "draft",
        createdAt: now,
        approvedAt: "",
        publishedAt: "",
        postId: "",
        error: "",
      }))
    );
  }

  async update(id: string, patch: Partial<Post>): Promise<void> {
    const sheet = await this.postsSheet();
    const rows = await sheet.getRows<Record<PostHeader, string>>();
    const row = rows.find((r) => r.get("id") === id);
    if (!row) throw new Error(`投稿が見つかりません: ${id}`);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      row.set(k as PostHeader, String(v));
    }
    await row.save();
  }

  async listTopics(): Promise<string[]> {
    const sheet = await this.topicsSheet();
    // ヘッダーの有無に関わらず A 列をそのまま読む（非エンジニアが1行目から書いても動くように）
    await sheet.loadCells(`A1:A${Math.max(sheet.rowCount, 1)}`);
    const topics: string[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const value = sheet.getCell(r, 0).value;
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (!text || text.toLowerCase() === "topic") continue;
      topics.push(text);
    }
    return topics;
  }
}

function rowToPost(obj: Record<PostHeader, string>): Post {
  const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  return {
    id: obj.id,
    platform: obj.platform as Post["platform"],
    topic: obj.topic ?? "",
    text: obj.text ?? "",
    imageUrl: opt(obj.imageUrl),
    status: (obj.status?.trim() as PostStatus) || "draft",
    createdAt: obj.createdAt ?? "",
    approvedAt: opt(obj.approvedAt),
    publishedAt: opt(obj.publishedAt),
    postId: opt(obj.postId),
    error: opt(obj.error),
  };
}
