import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/persona";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/** data URL からメディアタイプと純粋な base64 文字列を取り出す */
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function toContentBlocks(
  message: ChatMessage
): Anthropic.MessageParam["content"] {
  // assistant の履歴はテキストのみ
  if (message.role === "assistant") {
    return message.text;
  }

  const blocks: Anthropic.ContentBlockParam[] = [];

  for (const image of message.images ?? []) {
    const parsed = parseDataUrl(image.dataUrl);
    if (!parsed) continue;
    if (!SUPPORTED_IMAGE_TYPES.has(parsed.mediaType)) continue;
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: parsed.data,
      },
    });
  }

  const text = message.text.trim();
  // 画像のみ（テキストなし）の場合も、モデルが混乱しないよう案内文を添える
  blocks.push({
    type: "text",
    text: text.length > 0 ? text : "この食事についてフィードバックをお願いします。",
  });

  return blocks;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY が設定されていません。.env.local に設定してください。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages が空です");
    }
  } catch {
    return new Response(JSON.stringify({ error: "リクエストが不正です。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: toContentBlocks(m),
  }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: buildSystemPrompt(),
          messages: apiMessages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "予期しないエラーが発生しました。";
        controller.enqueue(
          encoder.encode(`\n\n[エラー] ${msg}`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
