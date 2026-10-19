/**
 * Meta（Instagram Graph API / Threads API）向けの最小 HTTP クライアント。
 * エラー時は Meta が返す error.message / error.code をそのまま例外にします。
 */

export interface GraphRequest {
  method?: "GET" | "POST";
  params?: Record<string, string | number | undefined>;
  token: string;
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

export async function graphFetch<T = Record<string, unknown>>(
  baseUrl: string,
  path: string,
  req: GraphRequest
): Promise<T> {
  const method = req.method ?? "GET";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(req.params ?? {})) {
    if (v !== undefined && v !== "") search.set(k, String(v));
  }
  search.set("access_token", req.token);

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res =
    method === "GET"
      ? await fetch(`${url}?${search.toString()}`)
      : await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: search.toString(),
        });

  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const err = (body as MetaErrorBody).error;
    const detail = err
      ? `${err.message ?? "unknown"} (code ${err.code ?? "?"}${
          err.error_subcode ? `/${err.error_subcode}` : ""
        })`
      : text.slice(0, 300);
    throw new Error(`Meta API エラー ${res.status} ${path}: ${detail}`);
  }
  return body as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
