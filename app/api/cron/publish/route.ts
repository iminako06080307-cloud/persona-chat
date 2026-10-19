import { getStore } from "@/lib/sns/store";
import { publishApproved } from "@/lib/sns/publish";
import { isAuthorizedCron, json, unauthorized } from "@/lib/sns/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 承認済み投稿を公開する Cron エンドポイント。
 * vercel.json のスケジュールで 1 日 1 回呼ばれます。手動確認は
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/publish
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorized();

  const logs: string[] = [];
  try {
    const result = await publishApproved({
      store: getStore(),
      budgetMs: 50_000,
      log: (m) => logs.push(m),
    });
    return json({ ok: true, ...result, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message, logs }, 500);
  }
}
