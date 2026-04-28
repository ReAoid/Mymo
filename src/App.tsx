import { useEffect } from "react";
import Pet from "./pet/Pet";
import Bubble from "./pet/Bubble";
import ChatPanel from "./chat/ChatPanel";
import { usePetStore } from "./store";

export default function App() {
  const { provider, model } = usePetStore();

  useEffect(() => {
    // Tauri 全局事件：热键 toggle-chat
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const un = await listen("toggle-chat", () => {
          usePetStore.getState().toggleChat();
        });
        unlisten = un;
      } catch {
        // 非 Tauri 环境（纯浏览器）直接忽略
      }
    })();
    return () => unlisten?.();
  }, []);

  return (
    <div className="app">
      <div className="status">
        {provider} · {model}
      </div>
      <ChatPanel />
      <Bubble />
      <Pet />
    </div>
  );
}
