import { fetch } from "@tauri-apps/plugin-http";
import type { ChatMessage } from "../store";
import { usePetStore } from "../store";

type OnChunk = (text: string) => void;

export async function streamChat(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
): Promise<void> {
  const { provider } = usePetStore.getState().settings;
  if (provider === "anthropic") return streamAnthropic(history, onChunk, signal);
  if (provider === "openai") return streamOpenAI(history, onChunk, signal);
  if (provider === "ollama") return streamOllama(history, onChunk, signal);
  throw new Error(`未知的 provider: ${provider}`);
}

// ---------- Anthropic ----------
async function streamAnthropic(
  history: ChatMessage[],
  onChunk: OnChunk,
  signal: AbortSignal
) {
  const { apiKey, model, systemPrompt } = usePetStore.getState().settings;
  if (!apiKey) throw new Error("缺少 Anthropic API Key（右键宠物打开设置）");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
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
  const { apiKey, baseUrl, model, systemPrompt } =
    usePetStore.getState().settings;
  if (!apiKey) throw new Error("缺少 OpenAI API Key（右键宠物打开设置）");
  const base = baseUrl || "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
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
  const { baseUrl, model, systemPrompt } = usePetStore.getState().settings;
  const base = baseUrl || "http://localhost:11434";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
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
