import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism2";
import { usePetStore } from "../store";

Live2DModel.registerTicker(PIXI.Ticker);

const MODEL_URL = "/live2d/Pio/model.json";

export default function Pet() {
  const { petState, toggleChat } = usePetStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const app = new PIXI.Application({
      view: canvas,
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoStart: true,
    });
    appRef.current = app;

    (async () => {
      try {
        const model = await Live2DModel.from(MODEL_URL, { autoInteract: false });
        if (cancelled) {
          model.destroy();
          return;
        }
        app.stage.addChild(model);
        modelRef.current = model;
        fitModel(model, app);
        const onResize = () => fitModel(model, app);
        window.addEventListener("resize", onResize);
        (model as any)._onResize = onResize;
        try {
          model.motion("idle");
        } catch {}
      } catch (err) {
        console.error("[live2d] load failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      const m = modelRef.current;
      if (m) {
        const onResize = (m as any)._onResize as (() => void) | undefined;
        if (onResize) window.removeEventListener("resize", onResize);
        try {
          m.destroy({ children: true });
        } catch {}
        modelRef.current = null;
      }
      try {
        app.destroy(false, { children: true, texture: true, baseTexture: true });
      } catch {}
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    try {
      if (petState === "talking") {
        model.motion("");
      } else {
        model.motion("idle");
      }
    } catch {}
  }, [petState]);

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
    if (dx < 4 && dy < 4) toggleChat();
  };

  return (
    <div
      ref={containerRef}
      className="pet-stage"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      title="点击打开聊天，按住拖拽移动窗口"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

function fitModel(model: Live2DModel, app: PIXI.Application) {
  const { width, height } = app.renderer;
  const mw = model.width || 1;
  const mh = model.height || 1;
  const scale = Math.min(width / mw, height / mh) * 0.95;
  model.scale.set(scale);
  model.x = (width - mw * scale) / 2;
  model.y = height - mh * scale;
}
