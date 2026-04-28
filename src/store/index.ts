import { create } from "zustand";

export type PetState = "idle" | "talking" | "thinking";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Store {
  petState: PetState;
  bubble: string;
  bubbleUntil: number;
  chatOpen: boolean;
  messages: ChatMessage[];
  provider: string;
  model: string;

  setPetState: (s: PetState) => void;
  showBubble: (text: string, ms?: number) => void;
  clearBubble: () => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  addMessage: (m: ChatMessage) => void;
  appendAssistant: (chunk: string) => void;
  resetMessages: () => void;
}

const PROVIDER = (import.meta.env.VITE_LLM_PROVIDER as string) || "anthropic";
const MODEL =
  PROVIDER === "anthropic"
    ? import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-6"
    : PROVIDER === "openai"
    ? import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini"
    : import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b";

export const usePetStore = create<Store>((set, get) => ({
  petState: "idle",
  bubble: "",
  bubbleUntil: 0,
  chatOpen: false,
  messages: [],
  provider: PROVIDER,
  model: MODEL,

  setPetState: (s) => set({ petState: s }),
  showBubble: (text, ms = 4000) => {
    set({ bubble: text, bubbleUntil: Date.now() + ms });
    setTimeout(() => {
      if (get().bubbleUntil <= Date.now()) set({ bubble: "" });
    }, ms + 50);
  },
  clearBubble: () => set({ bubble: "", bubbleUntil: 0 }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendAssistant: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      } else {
        msgs.push({ role: "assistant", content: chunk });
      }
      return { messages: msgs };
    }),
  resetMessages: () => set({ messages: [] }),
}));
