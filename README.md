# Mymo

> 一个常驻桌面的 AI 伙伴，看得见、听得懂、记得住（WIP）。

基于 Tauri 2 + React + TypeScript 的桌宠 MVP：透明置顶窗口、聊天面板、多 LLM 提供方（Anthropic / OpenAI / Ollama）流式对话、全局热键、系统托盘。

## 运行

```bash
# 1. 安装依赖
npm install

# 2. 生成 Tauri 所需图标（首次构建前必须执行）
npm run tauri icon app-icon.png

# 3. 配置 LLM
cp .env.example .env.local
# 编辑 .env.local，把 VITE_LLM_PROVIDER 设为 anthropic / openai / ollama 三选一，填对应 key

# 4. 启动
npm run tauri:dev
```

打包：`npm run tauri:build`。

## 注意事项

- **Node.js ≥ 18**，需要本机 Rust stable 工具链；各平台另有 Tauri 系统依赖。
- **修改 `.env.local` 必须重启 dev**，Vite 环境变量不会热更新。
- **Anthropic 直连**：当前 MVP 在 WebView 里直接调用 Anthropic API，生产请走自有后端代理，避免 key 随包分发。
- **macOS 热键授权**：首次使用需在「系统设置 → 隐私与安全性 → 辅助功能 / 输入监控」中授权 Mymo。
