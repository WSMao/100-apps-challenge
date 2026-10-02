import React from 'react';
import { Mail, MessageCircleHeart, Sparkles, Check, Heart, Eye } from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';

interface NavbarProps {
  totalApps: number;
  maxApps?: number;
  totalLikes: number;
  totalViews: number;
  guestbookCount: number;
  onOpenGuestbook: () => void;
  onShowToast: (msg: string) => void;
  githubUrl?: string;
  contactEmail?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalApps,
  maxApps = 100,
  totalLikes,
  totalViews,
  guestbookCount,
  onOpenGuestbook,
  onShowToast,
  githubUrl = 'https://github.com/WSMao',
  contactEmail = 'wsm8236@gmail.com',
}) => {
  const [copiedEmail, setCopiedEmail] = React.useState(false);
  const percentage = Math.min(100, Math.round((totalApps / maxApps) * 100));

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopiedEmail(true);
    onShowToast(`已複製 Email：${contactEmail}`);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* 左側：Logo 與挑戰標題 */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-100 text-base sm:text-lg tracking-tight">
              100 Apps Challenge
            </span>
          </div>
        </div>

        {/* 中間：進度條與愛心/瀏覽數統計 */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* 當前進度條 (Desktop) */}
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(4, percentage)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-indigo-400">
              {totalApps} <span className="text-slate-500">/</span> {maxApps}
            </span>
          </div>

          {/* 愛心數 (純 icon + 數量) */}
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono font-bold text-pink-400 shadow-sm shrink-0"
            title={`累計總愛心數：${totalLikes}`}
          >
            <Heart className="w-4 h-4 fill-pink-500/20 text-pink-400" />
            <span>{totalLikes}</span>
          </div>

          {/* 總瀏覽數 (純 icon + 數量) */}
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono font-bold text-cyan-400 shadow-sm shrink-0"
            title={`總瀏覽人次：${totalViews}`}
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>{totalViews}</span>
          </div>
        </div>

        {/* 右側按鈕：留言板 + GitHub + Mail (純 icon) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 許願留言板按鈕 */}
          <button
            onClick={onOpenGuestbook}
            className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-pink-300 bg-pink-950/40 hover:bg-pink-900/50 border border-pink-700/50 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
            title="開啟訪客許願與留言板"
          >
            <MessageCircleHeart className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">許願留言</span>
            {guestbookCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-500 text-white font-mono">
                {guestbookCount}
              </span>
            )}
          </button>

          <div className="h-5 w-[1px] bg-slate-800 mx-1" />

          {/* GitHub 連結 (純 icon) */}
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            title="造訪作者 GitHub 主頁"
          >
            <GithubIcon className="w-4 h-4" />
          </a>

          {/* 複製 Email 按鈕 (純 icon) */}
          <button
            onClick={handleCopyEmail}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            title={`點擊複製 Email: ${contactEmail}`}
          >
            {copiedEmail ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Mail className="w-4 h-4 text-slate-400 hover:text-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
