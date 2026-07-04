export type Role = "user" | "assistant";

export interface ChatImage {
  /** data URL 形式 (例: "data:image/jpeg;base64,....") */
  dataUrl: string;
  mediaType: string;
}

export interface ChatMessage {
  role: Role;
  text: string;
  images?: ChatImage[];
}
