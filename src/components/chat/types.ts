// Tipos compartilhados para componentes do Chat

export interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  model?: string;
  reasoning?: string;
  isStreaming?: boolean;
  files?: { name: string; type: string; url?: string }[];
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type FileStatus = "processing" | "completed" | "error";

// Formatador de data em pt-BR
export const formatPtBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
