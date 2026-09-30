import { useState, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { AppCard } from './components/AppCard';
import { DocViewerModal } from './components/DocViewerModal';
import { GuestbookModal } from './components/GuestbookModal';
import { Toast } from './components/Toast';
import { Footer } from './components/Footer';
import {
  getAllApps,
  getAppReadme,
  getFeedbackData,
  toggleAppLike,
  recordAppView,
  getGuestbookList,
} from './services/appService';
import type { AppStatus } from './types/app';
import { Inbox } from 'lucide-react';

export function App() {
  // 1. 自動載入所有 App Manifest
  const allApps = useMemo(() => getAllApps(), []);

  // 2. 篩選與搜尋狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | AppStatus>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 3. 互動數據狀態 (Likes & Views)
  const [feedback, setFeedback] = useState(() => getFeedbackData());
  const [guestbookCount, setGuestbookCount] = useState(() => getGuestbookList().length);

  // 4. Modal 彈窗狀態
  const [docModal, setDocModal] = useState<{
    isOpen: boolean;
    appId: string;
    appName: string;
    content: string;
    demoUrl?: string;
  }>({
    isOpen: false,
    appId: '',
    appName: '',
    content: '',
  });

  const [guestbookModal, setGuestbookModal] = useState<{
    isOpen: boolean;
    defaultAppId?: string;
  }>({
    isOpen: false,
  });

  // 5. Toast 訊息提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 錨點滾動
  const appsSectionRef = useRef<HTMLDivElement>(null);
  const handleScrollToApps = () => {
    appsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 統計總數據
  const totalLikes = useMemo(() => {
    return Object.values(feedback.likes).reduce((acc, curr) => acc + curr, 0);
  }, [feedback.likes]);

  const totalViews = useMemo(() => {
    return Object.values(feedback.views).reduce((acc, curr) => acc + curr, 0);
  }, [feedback.views]);

  // 所有不重複的 Tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    allApps.forEach((a) => a.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [allApps]);

  // 依條件過濾後的 App 列表
  const filteredApps = useMemo(() => {
    return allApps.filter((app) => {
      // 狀態篩選
      if (selectedStatus !== 'all' && app.status !== selectedStatus) {
        return false;
      }
      // 標籤篩選
      if (selectedTag && !app.tags.includes(selectedTag)) {
        return false;
      }
      // 關鍵字搜尋
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = app.id.toLowerCase().includes(q);
        const matchName = app.name.toLowerCase().includes(q);
        const matchDesc = app.description.toLowerCase().includes(q);
        const matchTag = app.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchId && !matchName && !matchDesc && !matchTag) {
          return false;
        }
      }
      return true;
    });
  }, [allApps, selectedStatus, selectedTag, searchQuery]);

  // 互動處理：按讚
  const handleLike = (appId: string) => {
    const res = toggleAppLike(appId);
    setFeedback((prev) => ({
      ...prev,
      likes: { ...prev.likes, [appId]: res.likes },
      userLiked: { ...prev.userLiked, [appId]: res.hasLiked },
    }));

    if (res.hasLiked) {
      showToast('感謝您的按讚支持！💖');
    }
  };

  // 互動處理：開啟文件閱讀
  const handleOpenDoc = (appId: string) => {
    const app = allApps.find((a) => a.id === appId);
    if (!app) return;

    // 閱讀文件同時視為瀏覽行為
    const newViews = recordAppView(appId);
    setFeedback((prev) => ({
      ...prev,
      views: { ...prev.views, [appId]: newViews },
    }));

    const content = getAppReadme(appId);
    setDocModal({
      isOpen: true,
      appId: app.id,
      appName: app.name,
      content,
      demoUrl: app.demoUrl,
    });
  };

  // 互動處理：點擊體驗 Demo
  const handleDemoClick = (appId: string) => {
    const newViews = recordAppView(appId);
    setFeedback((prev) => ({
      ...prev,
      views: { ...prev.views, [appId]: newViews },
    }));
  };

  // 互動處理：開啟留言許願
  const handleOpenWish = (appId?: string) => {
    setGuestbookModal({
      isOpen: true,
      defaultAppId: appId,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 頂部導航列 */}
      <Navbar
        totalApps={allApps.length}
        maxApps={100}
        guestbookCount={guestbookCount}
        onOpenGuestbook={() => handleOpenWish()}
        onShowToast={showToast}
      />

      {/* Hero 區域 */}
      <Hero
        totalApps={allApps.length}
        totalLikes={totalLikes}
        totalViews={totalViews}
        totalFeedback={guestbookCount}
        onExploreClick={handleScrollToApps}
      />

      {/* 作品卡片核心展示區 */}
      <main ref={appsSectionRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 標題與簡介 */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                探索挑戰應用
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {filteredApps.length} 款
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              各應用皆為獨立自包含模組，自動同步資料驅動呈現
            </p>
          </div>
        </div>

        {/* 篩選與搜尋列 */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          availableTags={availableTags}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          totalFiltered={filteredApps.length}
        />

        {/* 卡片網格 */}
        {filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                likes={feedback.likes[app.id] ?? 0}
                views={feedback.views[app.id] ?? 0}
                hasLiked={!!feedback.userLiked[app.id]}
                onLike={handleLike}
                onOpenDoc={handleOpenDoc}
                onOpenWish={handleOpenWish}
                onDemoClick={handleDemoClick}
              />
            ))}
          </div>
        ) : (
          /* 空狀態 */
          <div className="text-center py-20 rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8 space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200">找不到符合條件的 App</h3>
            <p className="text-xs text-slate-400">
              嘗試調整搜尋關鍵字，或清除標籤與狀態過濾器。
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedTag(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors"
            >
              清除所有篩選條件
            </button>
          </div>
        )}
      </main>

      {/* 頁尾 */}
      <Footer
        onOpenGuestbook={() => handleOpenWish()}
        onShowToast={showToast}
      />

      {/* Doc 查看彈窗 (README.md) */}
      <DocViewerModal
        isOpen={docModal.isOpen}
        onClose={() => setDocModal((prev) => ({ ...prev, isOpen: false }))}
        appId={docModal.appId}
        appName={docModal.appName}
        markdownContent={docModal.content}
        demoUrl={docModal.demoUrl}
      />

      {/* 留言與許願彈窗 */}
      <GuestbookModal
        isOpen={guestbookModal.isOpen}
        onClose={() => setGuestbookModal({ isOpen: false })}
        apps={allApps}
        defaultAppId={guestbookModal.defaultAppId}
        onAddedEntry={() => {
          setGuestbookCount(getGuestbookList().length);
          showToast('留言已送出，感謝您的反饋！🎉');
        }}
      />

      {/* 浮動提示 Toast */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default App;
