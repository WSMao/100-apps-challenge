# Git Commands & Sandbox Execution Cheatsheet

本文件提供在 Antigravity 環境下執行 100 Apps Challenge 相關 Git 操作的標準指令與注意事項。

---

## 1. 確認使用正確的分支 add changes


## 2. 提交變更 (Commit Workflow)

```bash
# 1. 檢查未提交變更
git status

# 2. 暫存該 App 目錄（若沙盒報 index.lock 錯誤，切換為 BypassSandbox: true）
git add apps/<id>-<name>/

# 3. 提交變更 (Conventional Commits 規範)
git commit -m "<type>(<scope>): <description>" -m "- 項目 1\n- 項目 2\n\nAgent: Antigravity"
```

---

## 3. 合併與推播 (Merge to Main & Push)

```bash
# 1. 切換至 main 分支
git checkout main

# 2. 合併特定 App 分支
git merge <id>-<name> -m "Merge branch '<id>-<name>' into main"

# 3. 推送兩分支至 GitHub（需要連外網路，必須使用 BypassSandbox: true）
git push origin <id>-<name>
git push origin main

# 4. 切換回開發分支
git checkout <id>-<name>
```

---

## 4. 沙盒模式對照說明

| 指令 | 建議模式 | 原因 / 注意事項 |
| :--- | :--- | :--- |
| `git status`, `git log`, `git diff` | Standard Sandbox (`BypassSandbox: false`) | 純唯讀操作，沙盒內可順暢執行 |
| `git add`, `git commit`, `git checkout`, `git merge` | `BypassSandbox: true`（若遇鎖定） | 需要寫入 `.git/index.lock` 與更新 Git refs |
| `git push`, `git pull`, `git fetch` | `BypassSandbox: true` | 需要 SSH (Port 22) 或 HTTPS 網路通訊存取 GitHub |

