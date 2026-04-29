import { useEffect, useState } from "react";
import { usePetStore, defaultsForProvider, type Provider, type Settings } from "../store";

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI 兼容",
  ollama: "Ollama（本地）",
};

export default function SettingsPanel() {
  const { settingsOpen, setSettingsOpen, settings, updateSettings } = usePetStore();
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setDraft(settings);
      setShowKey(false);
    }
  }, [settingsOpen, settings]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  const patch = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));

  const onProviderChange = (p: Provider) => {
    const d = defaultsForProvider(p);
    setDraft((cur) => ({
      ...cur,
      provider: p,
      model: d.model,
      baseUrl: d.baseUrl,
      apiKey: p === "ollama" ? "" : cur.apiKey,
    }));
  };

  const save = () => {
    updateSettings(draft);
    setSettingsOpen(false);
  };

  const needsKey = draft.provider !== "ollama";
  const needsBase = draft.provider !== "anthropic";

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span>设置</span>
        <button className="icon-btn" onClick={() => setSettingsOpen(false)} title="关闭">
          ✕
        </button>
      </div>

      <div className="settings-body">
        <label className="settings-row">
          <span>模型服务</span>
          <select
            value={draft.provider}
            onChange={(e) => onProviderChange(e.target.value as Provider)}
          >
            {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-row">
          <span>模型名</span>
          <input
            value={draft.model}
            onChange={(e) => patch({ model: e.target.value })}
            placeholder="例如 claude-sonnet-4-6"
          />
        </label>

        {needsKey && (
          <label className="settings-row">
            <span>API Key</span>
            <div className="settings-key">
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? "隐藏" : "显示"}
              >
                {showKey ? "🙈" : "👁"}
              </button>
            </div>
          </label>
        )}

        {needsBase && (
          <label className="settings-row">
            <span>Base URL</span>
            <input
              value={draft.baseUrl}
              onChange={(e) => patch({ baseUrl: e.target.value })}
              placeholder={
                draft.provider === "openai"
                  ? "https://api.openai.com/v1"
                  : "http://localhost:11434"
              }
            />
          </label>
        )}

        <label className="settings-row settings-row--col">
          <span>System Prompt</span>
          <textarea
            rows={4}
            value={draft.systemPrompt}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
          />
        </label>
      </div>

      <div className="settings-footer">
        <button className="btn-ghost" onClick={() => setSettingsOpen(false)}>
          取消
        </button>
        <button className="btn-primary" onClick={save}>
          保存
        </button>
      </div>
    </div>
  );
}
