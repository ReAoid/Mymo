import { useEffect, useRef, useState } from "react";
import { usePetStore } from "../store";
import { streamChat } from "../api/llm";

export default function ChatPanel() {
  const {
    chatOpen,
    setChatOpen,
    messages,
    addMessage,
    appendAssistant,
    setPetState,
    showBubble,
  } = usePetStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setChatOpen]);

  if (!chatOpen) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setBusy(true);
    setPetState("thinking");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // 先占位一条空的 assistant 消息，让 appendAssistant 累加
      addMessage({ role: "assistant", content: "" });
      setPetState("talking");
      let acc = "";
      await streamChat(
        [...usePetStore.getState().messages.slice(0, -1)],
        (chunk) => {
          acc += chunk;
          appendAssistant(chunk);
        },
        controller.signal
      );
      showBubble(acc.slice(0, 60));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendAssistant(`\n[错误] ${msg}`);
    } finally {
      setBusy(false);
      setPetState("idle");
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat-msg assistant">你好，我是 Mymo ~ 随便聊点什么吧。</div>
        )}
        {messages.map((m, i) => (
          <div className={`chat-msg ${m.role}`} key={i}>
            {m.role === "user" ? "🧑 " : "🐾 "}
            {m.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={input}
          disabled={busy}
          placeholder="说点什么…（Esc 关闭）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={busy}>
          {busy ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
