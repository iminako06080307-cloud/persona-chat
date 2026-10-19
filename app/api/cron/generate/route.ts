import { getStore } from "@/lib/sns/store";
import { createDrafts } from "@/lib/sns/drafts";
import { isAuthorizedCron, json, unauthorized } from "@/lib/sns/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 下書きを自動生成する Cron エンドポイント（任意）。
 * ローカルの `npm run generate` と同じ処理です。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorized();

  const logs: string[] = [];
  try {
    const count = Number(process.env.GENERATE_TOPICS_PER_RUN ?? 2);
    const result = await createDrafts({ store: getStore(), count, log: (m) => logs.push(m) });
    return json({ ok: true, ...result, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message, logs }, 500);
  }
}
