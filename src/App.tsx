import { useEffect } from "react";
import Pet from "./pet/Pet";
import Bubble from "./pet/Bubble";
import ChatPanel from "./chat/ChatPanel";
import SettingsPanel from "./settings/SettingsPanel";
import { usePetStore } from "./store";

export default function App() {
  const { settings } = usePetStore();

  useEffect(() => {
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
        {settings.provider} · {settings.model}
      </div>
      <SettingsPanel />
      <ChatPanel />
      <Bubble />
      <Pet />
    </div>
  );
}
