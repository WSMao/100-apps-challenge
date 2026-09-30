# 001-Challenge Showcase

用來展示 100 Apps Challenge 的總入口網站與展示中心。此專案記錄創作者的創作軌跡，提供探索與互動展示空間，藉此調查哪些產品受到喜愛且具備潛在市場需求，並提供直接聯絡方式促進進一步交流與合作。

---

## 🛠️ 技術路線
- **前端框架**：React 19 + TypeScript
- **建置工具**：Vite 8
- **樣式庫**：Tailwind CSS v4
- **圖示庫**：Lucide React
- **文件解析**：Marked (支援即時 Markdown 彈窗預覽各專案 README.md)
- **動效與反饋**：Canvas Confetti (點擊愛心/互動慶祝微動效)
- **架構模式**：資料驅動 (Data-Driven)，透過 Vite 編譯期動態掃描所有子 App 之 `app-manifest.json` 與 `README.md`，無須手動硬編碼清單。

---

## 📦 依賴管理
- 本專案採用 **pnpm** 作為統一依賴套件管理工具。
- 全域硬連結儲存庫可大幅節省磁碟空間，並防止幽靈依賴（Phantom Dependencies）。

---

## 🚀 安裝與啟動說明

```bash
# 進入子專案目錄
cd "apps/001-Challenge Showcase"

# 安裝依賴
pnpm install

# 啟動本地開發伺服器
pnpm dev

# 建置生產版本
pnpm build

# 本地預覽生產版本
pnpm preview
```

---

## 💡 使用說明
1. **作品探索卡片 (App Card)**：自動展示各 App 編號、名稱、開發狀態徽章、分類標籤、簡介。
2. **即時文件預覽 (Doc Viewer)**：點擊「查看文件」可直接以彈窗形式閱讀該 App 的 `README.md` 工程說明。
3. **即時搜尋與多維篩選**：支援關鍵字搜尋、依開發狀態（進行中 / 已完成）過濾、依技術 Tag 標籤過濾。
4. **互動與市場需求驗證 (Engagement Hub)**：
   - **愛心按讚 (Likes)**：點擊作品愛心給予好評，即時統計喜愛數，評估產品潛力。
   - **瀏覽計數 (Views)**：統計每個作品的造訪熱度。
   - **交流與聯絡 (Contact)**：一鍵複製 Email 帳號、前往 GitHub 個人主頁。
   - **留言與許願板 (Feedback & Wishlist)**：供訪客留言交流、提供建議或許願新功能。

---

## 📋 工作快照 (Work Snapshot)

| Agent 名稱 | 目前階段 | 最近完成 | 下一步 | 備註（問題） |
| :--- | :--- | :--- | :--- | :--- |
| Antigravity | MVP 完成 | 001 Showcase 正式驗收就緒：串接 Giscus GitHub Discussions、修復彈窗排版與響應式布局、支援雙模式留言與多標籤熱門度排序 | 規劃下一個應用（002），或串接 Supabase 數據持久化 | 專案建置正常，開發伺服器運行於 http://localhost:5173 |
