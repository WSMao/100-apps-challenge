---
name: pushflow
description: >-
  Standard operating procedures and automated git push flow for 100 Apps Challenge subprojects.
  Use this skill whenever asking to push changes (e.g. apps/001-*, apps/002-*, etc.), including Conventional
  Commits, README work snapshots, git merge to main, and base branch synchronization.
---

# 100 Apps Challenge 自動化推送工作流程與規範 (pushflow)

本 Skill 定義了在 **100 Apps Challenge** 專案群中開發功能後的標準 Push 流程與分支協調機制。

---

## 1. 核心邊界與分支定位 (Three-tier Branch Architecture)

- **子專案路徑**：所有獨立應用均放置於 `apps/<id>-<name>/`（例如 `apps/002-Good-Sleep/`）。
- **獨立 App 分支 (`<id>-<name>`)**：各 App 只能 add/commit 自己資料夾下的項目；完成後 merge 回 `main`。
- **全域骨架分支 (`base`)**：所有非特定 App 的全域修改（`rules.md`、`.agents/skills/` 等），一律使用 `base` 分支進行 Commit 與 Push，再 merge 入 `main`。**`base` 永遠不 merge 任何個別 App 分支**。
- **同步全域變更（使用 `merge base`）**：當 `base` 有更新時，進行中的 App 分支執行 `git merge base` 同步最新規範。**嚴禁 `git merge main`**（防止混入其他 App 代碼）。
- **為何採用 `merge base` 而非 `rebase base`？**
  - App 分支常已 Push 至遠端供多 Agent 協作，`rebase` 會重寫 Commit SHA 造成必須 force push (`--force`)，極易破壞多端協作；`merge base` 安全、非破壞性且免強制推播。

---

## 2. 開發與提交標準作業流程 (Standard Workflow)

### 步驟 1：維護工程文件與工作快照 (README.md)
若變更涉及特定 App，在每次 Commit 前必須同步更新該 App 目錄下 `README.md` 中的 **📋工作快照** 表格。

### 步驟 2：Conventional Commits 規範
- 遵守統一的 Conventional Commits 格式：
  ```text
  <type>(<scope>): <description>

  [optional body: 條列重點項目]

  Agent: Antigravity
  ```
- **Scope 限制**：
  - App 變更：`<scope>` 為 3 碼 App 編號（例如 `001`、`002`）。
  - 全域變更：`<scope>` 為 `base` 或 `root`（例如 `feat(base): ...`）。
- **常用 Type**：
  - `feat`: 新增功能
  - `fix`: 修復 Bug
  - `docs`: 純文件更新（README.md / rules.md）
  - `style`: 樣式排版微調
  - `refactor`: 重構（不增減功能）
  - `perf`: 效能提升
  - `chore`: 建置或雜項維護
  - `test`: 測試相關修改

### 步驟 3：執行 Git 指令（參照 references/git-commands.md）
> [!NOTE]
> 由於沙盒環境對 `.git/index.lock` 與連網 Port 22 的限制，執行 `git add`、`git commit`、`git checkout`、`git merge` 以及 `git push` 時若遇到權限錯誤，需以 `BypassSandbox: true` 執行。
