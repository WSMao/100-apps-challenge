# Git Commands & Sandbox Execution Cheatsheet

本文件提供在 Antigravity 環境下執行 100 Apps Challenge 相關 Git 操作的標準指令與注意事項。

---

## 情境 A：特定 App 功能開發與推播 (App Feature Workflow)

適用於 `apps/<id>-<name>/` 內的變更：

```bash
# 1. 確保在該 App 的專屬分支
git checkout <id>-<name>

# 2. 暫存該 App 目錄（禁止跨 App 或暫存全域檔案）
git add apps/<id>-<name>/

# 3. 提交變更 (Conventional Commits 規範)
git commit -m "<type>(<scope>): <description>" -m "- 項目 1\n- 項目 2\n\nAgent: Antigravity"

# 4. 切換至 main 分支並合併該 App
git checkout main
git merge <id>-<name> -m "Merge branch '<id>-<name>' into main"

# 5. 推送兩分支至 GitHub（需連網，使用 BypassSandbox: true）
git push origin <id>-<name>
git push origin main

# 6. 切換回開發分支
git checkout <id>-<name>
```

---

## 情境 B：全域規範或工具更新 (Global / Base Workflow)

適用於根目錄全域檔案（`rules.md`、`.agents/skills/`、`.gitignore` 等）：

```bash
# 1. 切換至 base 分支
git checkout base

# 2. 暫存全域項目（禁止暫存任何 apps/ 下的內容）
git add rules.md .agents/

# 3. 提交變更
git commit -m "feat(base): <description>" -m "- 項目說明\n\nAgent: Antigravity"

# 4. 推送 base 分支至 GitHub
git push origin base

# 5. 合併至 main 分支並推送
git checkout main
git merge base -m "Merge branch 'base' into main"
git push origin main

# 6. 切回原工作分支
git checkout <id>-<name>
```

---

## 情境 C：進行中 App 同步全域最新規範 (Sync Base to App)

當 `base` 有新增 Skill 或規則，進行中的 App 分支需同步時：

```bash
# 1. 切換至該 App 分支
git checkout <id>-<name>

# 2. 合併 base 分支（嚴禁 git merge main！）
git merge base -m "Merge branch 'base' into <id>-<name>"

# 3. 推送更新至 GitHub
git push origin <id>-<name>
```
> [!IMPORTANT]
> **為何使用 `git merge base` 而非 `rebase`？**
> App 分支通常已經推送至 GitHub 供多 Agent 協同開發。`rebase` 會改寫 Commit SHA 導致必須強制覆蓋 (`--force`)，極易造成協同衝突；`merge base` 屬於安全且非破壞性的合併，完全無需 force push。

---

## 情境 D：開啟全新 App 分支 (Kick off New App)

所有新 App 均由 `base` 出發，天然具備最新全域規範且不帶其他 App 雜質：

```bash
git checkout base
git pull origin base
git checkout -b <new-id>-<name>
```

---

## 沙盒模式對照說明

| 指令 | 建議模式 | 原因 / 注意事項 |
| :--- | :--- | :--- |
| `git status`, `git log`, `git diff` | Standard Sandbox (`BypassSandbox: false`) | 純唯讀操作，沙盒內可順暢執行 |
| `git add`, `git commit`, `git checkout`, `git merge` | `BypassSandbox: true`（若遇鎖定） | 需要寫入 `.git/index.lock` 與更新 Git refs |
| `git push`, `git pull`, `git fetch` | `BypassSandbox: true` | 需要 SSH (Port 22) 或 HTTPS 網路通訊存取 GitHub |
