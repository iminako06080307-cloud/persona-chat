import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { buildSystemPrompt } from "../persona";
import {
  INSTAGRAM_MAX_CHARS,
  PLATFORMS,
  THREADS_MAX_CHARS,
  type NewDraft,
  type Platform,
} from "./types";

/**
 * みきさんの口調で SNS 投稿の下書きを生成します。
 *
 * チャット用のペルソナ（lib/persona.ts）をそのまま system プロンプトの土台にし、
 * SNS 向けの形式ルールだけを追記しています。栄養のルール（油を足す提案をしない等）は
 * ペルソナ側に書いてあるので、ここでは繰り返しません。
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const SNS_ADDENDUM = `
# 今回の仕事：SNS 投稿の下書き
今回はサポート生さんへの返信ではなく、みきさんの Instagram と Threads に載せる投稿文を書きます。
読者は「これからダイエットを始めたい／停滞中の 40〜50 代女性」。フォロワーに語りかける文体で、
上記のみきさんの口調・考え方・栄養ルールをそのまま守ってください。

## Threads 向け（threads）
- ${THREADS_MAX_CHARS} 文字以内。マークダウン・見出し記号は使わない（プレーンテキスト）。
- 冒頭1行で興味を引き、具体的なコツを1〜2個、最後に短い励まし。
- ハッシュタグは付けない。絵文字は要所に少しだけ。

## Instagram 向け（instagram）
- キャプション本文は 300〜600 文字。段落ごとに空行で区切る。マークダウンは使わない。
- 画像は別途用意するので、本文で「この写真は〜」のように画像に言及しない。
- 最後に改行してからハッシュタグを 5〜10 個（例：#食べ痩せ #ダイエットコーチ #50代ダイエット）。
- ${INSTAGRAM_MAX_CHARS} 文字は絶対に超えない。

## 出力形式
次の JSON だけを返してください。前後に説明文やコードフェンスを付けないこと。
{"threads": "Threads 向け本文", "instagram": "Instagram キャプション"}
`;

export interface GenerateOptions {
  topics: string[];
  /** 既定は両方 */
  platforms?: Platform[];
  client?: Anthropic;
  model?: string;
}

interface GeneratedPair {
  threads: string;
  instagram: string;
}

export function buildSnsSystemPrompt(): string {
  return `${buildSystemPrompt()}\n\n${SNS_ADDENDUM}`;
}

/** コードフェンスや前後の文章を取り除いて JSON だけを取り出す */
export function extractJson(raw: string): GeneratedPair {
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("生成結果に JSON が見つかりません。");
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<GeneratedPair>;
  if (typeof parsed.threads !== "string" || typeof parsed.instagram !== "string") {
    throw new Error("生成結果の JSON に threads / instagram がありません。");
  }
  return { threads: parsed.threads.trim(), instagram: parsed.instagram.trim() };
}

/** 文の区切り（。！？や改行）で切り詰める。切れなければ単純に切る */
export function truncateAtSentence(text: string, max: number): string {
  if ([...text].length <= max) return text;
  const chars = [...text].slice(0, max);
  const joined = chars.join("");
  const idx = Math.max(
    joined.lastIndexOf("。"),
    joined.lastIndexOf("！"),
    joined.lastIndexOf("？"),
    joined.lastIndexOf("\n")
  );
  if (idx >= max * 0.5) return joined.slice(0, idx + 1).trimEnd();
  return joined.trimEnd();
}

async function askClaude(
  client: Anthropic,
  model: string,
  topic: string,
  extraInstruction?: string
): Promise<GeneratedPair> {
  const user = [`今回のお題：${topic}`, extraInstruction].filter(Boolean).join("\n\n");
  const res = await client.messages.create({
    model,
    max_tokens: 2048,
    system: buildSnsSystemPrompt(),
    messages: [{ role: "user", content: user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return extractJson(text);
}

/**
 * トピックごとに Threads と Instagram の下書きを作ります。
 * Threads が 500 文字を超えたら1回だけ短く作り直させ、それでも超えれば文末で切ります。
 */
export async function generatePosts(opts: GenerateOptions): Promise<NewDraft[]> {
  const platforms = opts.platforms ?? PLATFORMS;
  const model = opts.model ?? MODEL;
  const client =
    opts.client ??
    new Anthropic({
      apiKey:
        process.env.ANTHROPIC_API_KEY ??
        (() => {
          throw new Error("ANTHROPIC_API_KEY が設定されていません。");
        })(),
    });

  const drafts: NewDraft[] = [];

  for (const topic of opts.topics) {
    let pair = await askClaude(client, model, topic);

    if ([...pair.threads].length > THREADS_MAX_CHARS) {
      pair = await askClaude(
        client,
        model,
        topic,
        `前回の Threads 本文が ${THREADS_MAX_CHARS} 文字を超えていました。Threads 本文は必ず ${THREADS_MAX_CHARS} 文字以内に収めてください。`
      );
      pair.threads = truncateAtSentence(pair.threads, THREADS_MAX_CHARS);
    }
    pair.instagram = truncateAtSentence(pair.instagram, INSTAGRAM_MAX_CHARS);

    if (platforms.includes("threads")) {
      drafts.push({ id: randomUUID(), platform: "threads", topic, text: pair.threads });
    }
    if (platforms.includes("instagram")) {
      drafts.push({
        id: randomUUID(),
        platform: "instagram",
        topic,
        text: pair.instagram,
        imageUrl: "",
      });
    }
  }

  return drafts;
}
