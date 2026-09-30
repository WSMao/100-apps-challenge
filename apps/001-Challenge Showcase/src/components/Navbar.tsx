import React from 'react';
import { Mail, MessageCircleHeart, Sparkles, Check } from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';

interface NavbarProps {
  totalApps: number;
  maxApps?: number;
  guestbookCount: number;
  onOpenGuestbook: () => void;
  onShowToast: (msg: string) => void;
  githubUrl?: string;
  contactEmail?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalApps,
  maxApps = 100,
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
        {/* Logo 與挑戰標題 */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-100 text-base sm:text-lg tracking-tight">
                100 Apps Challenge
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                #001 Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              創作紀錄 · 市場潛力驗證 · 交流中心
            </p>
          </div>
        </div>

        {/* 中間：進度條 (Desktop) */}
        <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
          <span className="font-medium text-slate-400">當前進度：</span>
          <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500 rounded-full"
              style={{ width: `${Math.max(4, percentage)}%` }}
            />
          </div>
          <span className="font-mono font-bold text-indigo-400">
            {totalApps} <span className="text-slate-500">/</span> {maxApps}
          </span>
        </div>

        {/* 右側按鈕：留言板 + Contact */}
        <div className="flex items-center gap-2">
          {/* 許願留言板按鈕 */}
          <button
            onClick={onOpenGuestbook}
            className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-pink-300 bg-pink-950/40 hover:bg-pink-900/50 border border-pink-700/50 transition-all shadow-sm hover:scale-[1.02]"
            title="開啟訪客許願與留言板"
          >
            <MessageCircleHeart className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">許願與留言</span>
            {guestbookCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-500 text-white font-mono">
                {guestbookCount}
              </span>
            )}
          </button>

          <div className="h-5 w-[1px] bg-slate-800 mx-1" />

          {/* GitHub 連結 */}
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            title="造訪作者 GitHub 主頁"
          >
            <GithubIcon className="w-4 h-4" />
          </a>

          {/* 複製 Email 按鈕 */}
          <button
            onClick={handleCopyEmail}
            className="relative inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            title={`點擊複製 Email: ${contactEmail}`}
          >
            {copiedEmail ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Mail className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden lg:inline">{contactEmail}</span>
            {copiedEmail && (
              <span className="hidden sm:inline text-emerald-400 text-[11px] font-bold">已複製!</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
