---
name: pushflow
description: >-
  Standard operating procedures and automated git push flow for 100 Apps Challenge subprojects.
  Use this skill whenever asking to push changes (e.g. apps/001-*, apps/002-*, etc.), including Conventional
  Commits, README work snapshots, and git merge to main workflows.
---

# 100 Apps Challenge 自動化推送工作流程與規範 (pushflow)

本 Skill 定義了在 **100 Apps Challenge** 專案群中開發功能後的 push 流程。

---

## 1. 核心邊界與專案定位 (Scope Isolation)

- **子專案路徑**：所有獨立應用均放置於 `apps/<id>-<name>/`（例如 `apps/002-Good-Sleep/`）。
- **分支對應**：每款 App 一律使用獨立的分支 `<id>-<name>` 進行 commit（例如 `002-Good-Sleep`）。
- **全域性修改**：獨立於特定應用外的修改，應使用 `main` 分支進行，避免直接影響各 App 的功能分支。

---

## 2. 開發與提交標準作業流程 (Standard Workflow)

### 步驟 1：維護工程文件與工作快照 (README.md)
在每次 Commit 或重大功能變更時，必須同步更新該 App 目錄下的 `README.md` 中的 **📋工作快照** 表格。

### 步驟 2：Conventional Commits 規範
- 遵守統一的 Conventional Commits 格式：
  ```text
  <type>(<scope>): <description>

  [optional body: 條列重點項目]

  Agent: Antigravity
  ```
- **Scope 限制**：`<scope>` 必須為 3 碼 App 編號（例如 `001`、`002`）。
- **常用 Type**：
  - `feat`: 新增功能
  - `fix`: 修復 Bug
  - `docs`: 純文件更新（README.md / rules.md）
  - `style`: 樣式排版微調
  - `refactor`: 重構（不增減功能）
  - `perf`: 效能提升
  - `chore`: 建置或雜項維護
  - `test`: 測試相關修改

### 步驟 3：執行 Git 指令，直到完成 push（除非有錯誤發生）
> [!NOTE]
> 由於沙盒環境對 `.git/index.lock` 之檔案系統鎖定限制，執行 `git add` 與 `git commit` 時若遇到 `index.lock` 權限錯誤，需以 `BypassSandbox: true` 執行。

請參照 `references/git-commands.md`的步驟。

