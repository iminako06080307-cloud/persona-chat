"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./chat.module.css";
import type { ChatImage, ChatMessage } from "@/lib/types";

const WELCOME: ChatMessage = {
  role: "assistant",
  text:
    "こんにちは、美養バランスダイエットのみきです😊\n今日も一緒に、無理なく淡々といきましょう✨\n食べたものの写真や、気になっていることを送ってくださいね。しっかり見てフィードバックします◎",
};

const MAX_IMAGES = 4;

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<ChatImage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, staged, scrollToBottom]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const next: ChatImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (staged.length + next.length >= MAX_IMAGES) break;
        // スマホの写真は大きい（3〜8MB）ため、送信前に縮小して通信量とトークン代を抑える
        next.push(await prepareImage(file));
      }
      if (next.length > 0) setStaged((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    },
    [staged.length]
  );

  const removeStaged = (index: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if ((text.length === 0 && staged.length === 0) || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      text,
      images: staged.length > 0 ? staged : undefined,
    };

    const history = [...messages, userMessage];
    setMessages([...history, { role: "assistant", text: "" }]);
    setInput("");
    setStaged([]);
    setIsStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // welcome メッセージは会話履歴として送らない
        body: JSON.stringify({ messages: history.slice(1) }),
      });

      if (!res.ok || !res.body) {
        const errText = await safeErrorText(res);
        appendToLastAssistant(setMessages, `\n[エラー] ${errText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) appendToLastAssistant(setMessages, chunk);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      appendToLastAssistant(setMessages, `\n[エラー] ${msg}`);
    } finally {
      setIsStreaming(false);
    }
  }, [input, staged, isStreaming, messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.avatar}>み</div>
        <div className={styles.headerText}>
          <span className={styles.headerName}>みき（美養バランスダイエット）</span>
          <span className={styles.headerStatus}>
            {isStreaming ? "入力中…" : "オンライン・ダイエット伴走中"}
          </span>
        </div>
      </header>

      <div className={styles.messages} ref={messagesRef}>
        <p className={styles.intro}>
          食事の写真を送ると、コーチが「良い点」と「次の一歩」をフィードバックします。
        </p>
        {messages.map((m, i) => (
          <MessageRow
            key={i}
            message={m}
            streaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
          />
        ))}
      </div>

      {staged.length > 0 && (
        <div className={styles.staging}>
          {staged.map((img, i) => (
            <div key={i} className={styles.stagingItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.stagingImage} src={img.dataUrl} alt="添付画像" />
              <button
                className={styles.stagingRemove}
                onClick={() => removeStaged(i)}
                aria-label="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.inputBar}>
        <button
          className={styles.iconButton}
          onClick={() => fileInputRef.current?.click()}
          aria-label="写真を追加"
          disabled={isStreaming}
        >
          📷
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="メッセージを入力…"
          value={input}
          onChange={autoGrow}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <button
          className={styles.sendButton}
          onClick={send}
          disabled={isStreaming || (input.trim().length === 0 && staged.length === 0)}
          aria-label="送信"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : ""}`}>
      {!isUser && <div className={styles.rowAvatar}>み</div>}
      <div className={`${styles.bubble} ${isUser ? styles.user : styles.coach}`}>
        {message.images && message.images.length > 0 && (
          <div className={styles.bubbleImages}>
            {message.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                className={styles.bubbleImage}
                src={img.dataUrl}
                alt="送った食事の写真"
              />
            ))}
          </div>
        )}
        <span>{message.text}</span>
        {streaming && message.text.length === 0 && (
          <span className={styles.cursor} />
        )}
      </div>
    </div>
  );
}

function appendToLastAssistant(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  chunk: string
) {
  setMessages((prev) => {
    const next = [...prev];
    const last = next[next.length - 1];
    if (last && last.role === "assistant") {
      next[next.length - 1] = { ...last, text: last.text + chunk };
    }
    return next;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

/**
 * 画像を送信前にブラウザ側で縮小し、JPEG に変換する。
 * スマホの大きな写真がサーバーのリクエスト上限を超えて失敗するのを防ぎ、
 * 画像認識の精度は保ちつつ通信量・トークン代を抑える。
 * 変換に失敗した場合（HEIC 等でデコード不可）は元画像のまま返す。
 */
async function prepareImage(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<ChatImage> {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    // 十分小さければそのまま使う
    if (scale >= 1 && file.size < 1_500_000) {
      return { dataUrl, mediaType: file.type };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dataUrl, mediaType: file.type };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl: jpeg, mediaType: "image/jpeg" };
  } catch {
    // デコードできない形式はそのまま（サーバー側で未対応なら弾かれる）
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, mediaType: file.type };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像のデコードに失敗しました"));
    img.src = src;
  });
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
