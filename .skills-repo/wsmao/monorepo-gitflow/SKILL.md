---
name: monorepo-gitflow
description: >-
  專門管理單一倉庫內多個專案的工作流程。協助開發者在共享儲存庫中，有效隔離各專案版本、規劃分支策略，確保各個專案的開發與維護順暢。
  當涉及 git 相關的操作，請參考本 Skill 中的規範與流程，內容包含分支管理、提交規範與推送流程。
---

# Monorepo Gitflow 核心原則

本文件說明了在單一倉庫中管理多個專案的 Git 工作流程，確保各專案之間的變更隔離與版本控制的正確性。

- **禁止 Commit 敏感憑證**：每個專案必須在自己的目錄或全域 .gitignore 中明確排除 .env、*.local、金鑰文件，同時建立範例環境檔 .env.example。

- **禁止跨專案修改**: 各專案分支只能 `git add` 自己資料夾下的項目，禁止修改其他專案的內容。

- **多任務並行時**：應使用 `git worktree`，讓每個分支在獨立環境下運行。


## 1. 分支定位與核心邊界

1. **倉庫主分支（`main`）**：作為整個倉庫的最終穩定版本，只能由開發者操作。**嚴禁直接在 main 分支上進行開發**，僅從各「專案主分支」合併完成的功能與修復。

2. **全域骨架分支 (`base`)**：所有非特定專案的全域修改（`rules.md`、`.agents/skills/` 等），一律使用 `base` 分支進行 git 操作。**`base` 永遠不 merge 其他分支**。

3. **專案分支**：
  - 專案主分支(`<project-name>`)：各專案的主要分支，僅用於整合「專案開發分支」完成的功能與修復，保持穩定狀態，只能由開發者進行 merge 操作。任何新專案的起點，需以 `base` 分支為基礎建立對應的專案主分支。
  - 專案開發分支：每個專案可依需求建立開發分支，格式 `<type>/<project-name>/#<ticket-id>-<description>`，例如 `feat/my-app/#001-addlogin`。完成後發送 Pull Request，經審核後 merge 回專案主分支，禁止直接合併回 `main` 分支。當 `base` 分支有更新時，開發分支需及時執行 `git merge base` 同步最新規範。

## 2. 統一採用 Conventional Commit message 格式，標準結構如：
```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- <scope> 如未特別指定，則以專案為單位。
- 因為有多個 AI Agent 參與，使用 Footer 標註 AI Agent 來源

| Type | 說明 | 範例 |
| -----| ----|----- |
|`feat`      | 新增功能(Feature)	                 |feat(001): add filter tags for challenge apps|
|`fix`	     | 修復 Bug	                         |fix(001): resolve layout overflow on mobile screens
|`docs` 	   | 純文件更新（Markdown、註解）	          |docs(001): update README.md
|`style`	   | 不影響程式邏輯的排版/樣式修改	        |style(001): adjust card border radius and shadow
|`refactor`  | 重構（非 bug 修正，也非增減功能）	|refactor(001): extract AppCard into standalone component
|`perf`	     | 效能提升 (Performance)	              |perf(001): lazy load preview images
|`chore`	   | 建置工具、依賴或雜項維護	         |chore(base): add pnpm workspace config, update rules.md, Skills, MCPs
|`test`	     | 新增或修改測試	                      |test(001): add unit tests for date formatter

## 3. Git Workflow 情境參照

> [!NOTE]
> 由於沙盒環境對 `.git/index.lock` 與連網 Port 22 的限制，執行 `git add`、`git commit`、`git checkout`、`git merge` 以及 `git push` 時若遇到權限錯誤，需以 `BypassSandbox: true` 執行。


### 情境 A：開啟全新專案

所有新專案均由 `base` 出發

```bash
git checkout base
git pull origin base
git checkout -b <project-name>
```

---


### 情境 B：專案功能開發與推播 (Project Workflow)

範例假設情境：
- 專案名稱為： `001-app`
- 子專案資料夾路徑為： `<projects-folder>/001-app/`
- 待解決議題為：新增登入頁面，議題編號 `#001`

```bash

# 1. 切換到對應得專案主分支
git checkout 001-app

# 2. 確認專案主分支為最新狀態
git pull origin 001-app

# 3. 確認已取得最新的 base 更新
git fetch origin base
git merge origin/base

# 4. 建立對應的開發分支
git checkout -b feat/001-app/#001-addlogin

# 5. 新增變更項目（禁止跨專案或暫存全域檔案）
git add <projects-folder>/001-app/

# 6. 提交變更 (Conventional Commits 規範)
git commit -m "feat(<scope>): <description>" -m "- 項目 1\n- 項目 2\n\nAgent: Antigravity"

# 7. 發起 pull request
gh pr create --base 001-app --head feat/001-app/#001-addlogin --title "feat(001-app): add login" --body "- 項目 1\n- 項目 2\nCloses #001\n\nAgent: Antigravity"

# 8. 確認 PR 被審核與合併後，就可以刪除此開發分支
```

---

### 情境 C：全域規範或工具更新 (Global / Base Workflow)

適用於根目錄全域檔案（`rules.md`、`.agents/skills/`、`.gitignore` 等）：

```bash
# 1. 切換至 base 分支
git checkout base

# 2. 暫存全域項目（禁止暫存任何特定 project 下的內容）
git add rules.md .agents/

# 3. 提交變更
git commit -m "chore(base): <description>" -m "- 項目說明\n\nAgent: Antigravity"

# 4. 推送 base 分支至 GitHub
git push origin base

# 5. 切回原工作分支
git checkout <project-name>
```
