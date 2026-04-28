import { usePetStore } from "../store";
import { useRef } from "react";

export default function Pet() {
  const { petState, toggleChat } = usePetStore();
  // 记录 mousedown 时的位置，用于区分 "点击" vs "拖拽"
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    downPos.current = { x: e.clientX, y: e.clientY };
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {
      // 非 Tauri 环境忽略
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const d = downPos.current;
    downPos.current = null;
    if (!d) return;
    const dx = Math.abs(e.clientX - d.x);
    const dy = Math.abs(e.clientY - d.y);
    // 几乎没移动 → 视为点击，切换聊天面板
    if (dx < 4 && dy < 4) toggleChat();
  };

  return (
    <div
      className="pet-stage"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      title="点击打开聊天，按住拖拽移动窗口"
    >
      <div className={`pet-body ${petState}`}>
        <div className="pet-eyes">
          <div className="pet-eye" />
          <div className="pet-eye" />
        </div>
        <div className="pet-mouth" />
      </div>
    </div>
  );
}
