# `<app-name>`

> [One-sentence punchy tagline: what problem does this app solve, and for whom?]

[![Status](https://img.shields.io/badge/Status-Active-emerald.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()

---

## 核心痛點與特色 (Why this App?)

1. **[Pain Point 1]**：[Brief description of what traditional/competing tools fail at].
2. **[Pain Point 2]**：[How this app solves it seamlessly].
3. **[Key Innovation]**：[Unique differentiator, e.g., AI integration, bidirectional sync, local-first].

---

## 使用者指南 (User Guide)

### 快速開始
1. [Initial action].
2. [Second core workflow].
3. [Third core workflow].

---

## 開發者指南 (Developer Guide)

### 技術棧 (Tech Stack)
- **Frontend**：React 19 + TypeScript + Vite + Tailwind CSS
- **State & Storage**：Zustand + Immer + Zundo (Undo/Redo) + Dexie.js (IndexedDB)
- **Engines**：[Core layout/rendering engines]

### 架構概要 (Architecture Overview)

Example:
```text
Layer 5: Workspace & UI (Header, Toolbar, Modals, Shortcuts)
   ▲
Layer 4: Dedicated Editors (CodeMirror 6, Property Inspector)
   ▲
Layer 3: Canvas & Primitives (React Flow Nodes, Edges, Freehand)
   ▲
Layer 2: Core Engines (Pure-function Layout, Collision, Reconciliation)
   ▲
Layer 1: State Store & Persistence (Zustand Slices & IndexedDB)
```

### 本機開發與建置 (Getting Started)

Example:
```text
# 1. 安裝依賴
pnpm install

# 2. 啟動開發伺服器
pnpm -C apps/<id>-<app-name> dev

# 3. 執行測試套件
pnpm -C apps/<id>-<app-name> test:unit    # 單元與整合測試
pnpm -C apps/<id>-<app-name> test:engine  # 核心演算法引擎測試

# 4. 生產環境打包
pnpm -C apps/<id>-<app-name> build
```

