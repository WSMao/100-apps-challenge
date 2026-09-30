import React from 'react';
import { Heart, Eye, BookOpen, ExternalLink, MessageSquarePlus, Monitor, Globe, Smartphone, Terminal } from 'lucide-react';
import type { AppManifest } from '../types/app';
import confetti from 'canvas-confetti';

interface AppCardProps {
  app: AppManifest;
  likes: number;
  views: number;
  hasLiked: boolean;
  onLike: (appId: string) => void;
  onOpenDoc: (appId: string) => void;
  onOpenWish: (appId: string) => void;
  onDemoClick: (appId: string) => void;
}

export const AppCard: React.FC<AppCardProps> = ({
  app,
  likes,
  views,
  hasLiked,
  onLike,
  onOpenDoc,
  onOpenWish,
  onDemoClick,
}) => {
  // 狀態徽章風格
  const getStatusBadge = () => {
    switch (app.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            已完成
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            進行中
          </span>
        );
      case 'planned':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/40 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            規劃中
          </span>
        );
    }
  };

  // 平台圖示
  const getPlatformIcon = () => {
    switch (app.platform.toLowerCase()) {
      case 'web':
        return <Globe className="w-3.5 h-3.5" />;
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'cli':
        return <Terminal className="w-3.5 h-3.5" />;
      default:
        return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(app.id);

    // 觸發彩花微動效（若尚未按過讚）
    if (!hasLiked) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 25,
        spread: 60,
        origin: { x, y },
        colors: ['#ec4899', '#f43f5e', '#8b5cf6', '#a855f7'],
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="group relative rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 overflow-hidden shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col hover:-translate-y-1">
      {/* 封面圖 / 預覽區域 */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-slate-800/60">
        <img
          src={app.coverImage || '/assets/cover.svg'}
          alt={app.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // 容錯機制：若自訂圖片加載失敗，切換為預設 cover.svg
            (e.currentTarget as HTMLImageElement).src = '/assets/cover.svg';
          }}
        />

        {/* 頂部懸浮狀態與編號 */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-950/80 backdrop-blur-md text-indigo-300 border border-slate-700/60 shadow">
            #{app.id}
          </span>
          <div className="pointer-events-auto">
            {getStatusBadge()}
          </div>
        </div>

        {/* 底部懸浮：平台 */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950/80 backdrop-blur-md text-slate-300 border border-slate-800 shadow">
          {getPlatformIcon()}
          <span>{app.platform}</span>
        </div>
      </div>

      {/* 卡片主體內容 */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* 名稱 */}
          <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
            {app.name}
          </h3>

          {/* 簡介 */}
          <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {app.description}
          </p>

          {/* 標籤群 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {app.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/70 text-slate-300 border border-slate-700/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 互動指標與操作列 */}
        <div className="pt-3 border-t border-slate-800/70 space-y-3">
          {/* 互動反饋條 (愛心、瀏覽、許願) */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {/* 按讚愛心 */}
              <button
                onClick={handleLikeClick}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                  hasLiked
                    ? 'text-pink-400 bg-pink-500/15 border border-pink-500/30 font-bold scale-105'
                    : 'text-slate-400 hover:text-pink-400 hover:bg-slate-800'
                }`}
                title={hasLiked ? '已按讚 (點擊可收回)' : '喜歡這個作品！點擊按讚'}
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-transform ${
                    hasLiked ? 'fill-pink-500 text-pink-500 scale-110' : ''
                  }`}
                />
                <span className="font-mono text-[11px]">{likes}</span>
              </button>

              {/* 瀏覽次數 */}
              <div
                className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-mono"
                title={`已累計瀏覽 ${views} 次`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{views}</span>
              </div>
            </div>

            {/* 針對此 App 許願/回饋 */}
            <button
              onClick={() => onOpenWish(app.id)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-pink-300 transition-colors"
              title="針對此作品留言、建議或許願功能"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>回饋</span>
            </button>
          </div>

          {/* 按鈕組：查看文件 + Demo 連結 */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onOpenDoc(app.id)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700/80 shadow-sm cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>查看文件</span>
            </button>

            {app.demoUrl ? (
              <a
                href={app.demoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => onDemoClick(app.id)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02]"
              >
                <span>體驗 Demo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 bg-slate-800/40 border border-slate-800 cursor-not-allowed"
              >
                <span>即將推出</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
