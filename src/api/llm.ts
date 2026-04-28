import { fetch } from "@tauri-apps/plugin-http";
import type { ChatMessage } from "../store";

type OnChunk = (text: string) => void;

const SYSTEM_PROMPT =
  "你是 Mymo，一只温柔、机灵、陪伴感十足的桌面 AI 宠物。回答尽量简短（两三句），语气亲切偶尔俏皮。使用简体中文。";

const provider = (import.meta.env.VITE_LLM_PROVIDER as string) || "anthropic";

export async function streamChat(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
): Promise<void> {
  if (provider === "anthropic") return streamAnthropic(history, onChunk, signal);
  if (provider === "openai") return streamOpenAI(history, onChunk, signal);
  if (provider === "ollama") return streamOllama(history, onChunk, signal);
  throw new Error(`未知的 VITE_LLM_PROVIDER: ${provider}`);
}

// ---------- Anthropic ----------
async function streamAnthropic(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const model = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-6";
  if (!key) throw new Error("缺少 VITE_ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      stream: true,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok || !res.body) {
    const err = await safeText(res);
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }
  await readSSE(res.body, signal, (evt) => {
    if (evt.event === "content_block_delta") {
      const data = tryJson(evt.data);
      const t = data?.delta?.text;
      if (typeof t === "string") onChunk(t);
    }
  });
}

// ---------- OpenAI 兼容 ----------
async function streamOpenAI(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
) {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  const base = import.meta.env.VITE_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
  if (!key) throw new Error("缺少 VITE_OPENAI_API_KEY");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const err = await safeText(res);
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }
  await readSSE(res.body, signal, (evt) => {
    if (!evt.data || evt.data === "[DONE]") return;
    const data = tryJson(evt.data);
    const t = data?.choices?.[0]?.delta?.content;
    if (typeof t === "string") onChunk(t);
  });
}

// ---------- Ollama ----------
async function streamOllama(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
) {
  const base = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
  const model = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const err = await safeText(res);
    throw new Error(`Ollama ${res.status}: ${err}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    if (signal.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      const j = tryJson(line);
      const t = j?.message?.content;
      if (typeof t === "string" && t) onChunk(t);
    }
  }
}

// ---------- 工具 ----------
interface SSEEvent {
  event?: string;
  data: string;
}

async function readSSE(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (e: SSEEvent) => void
) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    if (signal.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evt: SSEEvent = { data: "" };
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) evt.event = line.slice(6).trim();
        else if (line.startsWith("data:")) evt.data += line.slice(5).trim();
      }
      if (evt.data) onEvent(evt);
    }
  }
}

function tryJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
