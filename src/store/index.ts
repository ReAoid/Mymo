import { create } from "zustand";

export type PetState = "idle" | "talking" | "thinking";
export type Provider = "anthropic" | "openai" | "ollama";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Settings {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl: string;
  systemPrompt: string;
}

interface Store {
  petState: PetState;
  bubble: string;
  bubbleUntil: number;
  chatOpen: boolean;
  settingsOpen: boolean;
  messages: ChatMessage[];
  settings: Settings;

  setPetState: (s: PetState) => void;
  showBubble: (text: string, ms?: number) => void;
  clearBubble: () => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addMessage: (m: ChatMessage) => void;
  appendAssistant: (chunk: string) => void;
  resetMessages: () => void;
}

const DEFAULT_SYSTEM_PROMPT =
  "你是 Mymo，一只温柔、机灵、陪伴感十足的桌面 AI 宠物。回答尽量简短（两三句），语气亲切偶尔俏皮。使用简体中文。";

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  ollama: "qwen2.5:7b",
};

const DEFAULT_BASE_URL: Record<Provider, string> = {
  anthropic: "",
  openai: "https://api.openai.com/v1",
  ollama: "http://localhost:11434",
};

const STORAGE_KEY = "mymo.settings";

function initialSettings(): Settings {
  const provider =
    ((import.meta.env.VITE_LLM_PROVIDER as string) || "anthropic") as Provider;
  const fromEnv: Settings = {
    provider,
    model:
      provider === "anthropic"
        ? import.meta.env.VITE_ANTHROPIC_MODEL || DEFAULT_MODEL.anthropic
        : provider === "openai"
        ? import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL.openai
        : import.meta.env.VITE_OLLAMA_MODEL || DEFAULT_MODEL.ollama,
    apiKey:
      provider === "anthropic"
        ? import.meta.env.VITE_ANTHROPIC_API_KEY || ""
        : provider === "openai"
        ? import.meta.env.VITE_OPENAI_API_KEY || ""
        : "",
    baseUrl:
      provider === "openai"
        ? import.meta.env.VITE_OPENAI_BASE_URL || DEFAULT_BASE_URL.openai
        : provider === "ollama"
        ? import.meta.env.VITE_OLLAMA_BASE_URL || DEFAULT_BASE_URL.ollama
        : "",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      return { ...fromEnv, ...saved };
    }
  } catch {}
  return fromEnv;
}

function persistSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export const defaultsForProvider = (p: Provider) => ({
  model: DEFAULT_MODEL[p],
  baseUrl: DEFAULT_BASE_URL[p],
});

export const usePetStore = create<Store>((set, get) => ({
  petState: "idle",
  bubble: "",
  bubbleUntil: 0,
  chatOpen: false,
  settingsOpen: false,
  messages: [],
  settings: initialSettings(),

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
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    persistSettings(next);
    set({ settings: next });
  },
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
