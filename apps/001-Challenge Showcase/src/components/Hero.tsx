import React from 'react';
import { Layers, Heart, Eye, MessageSquareQuote, Compass, Sparkles } from 'lucide-react';

interface HeroProps {
  totalApps: number;
  totalLikes: number;
  totalViews: number;
  totalFeedback: number;
  onExploreClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  totalApps,
  totalLikes,
  totalViews,
  totalFeedback,
  onExploreClick,
}) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-8 sm:pt-16 sm:pb-12 border-b border-slate-800/60 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950">
      {/* 背景裝飾光暈 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* 標籤小徽章 */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-indigo-300 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span className="font-medium">100 Apps Challenge · 自主全端與跨平台微應用挑戰</span>
        </div>

        {/* 主標題 */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-indigo-100 to-pink-200 tracking-tight max-w-4xl mx-auto leading-tight">
          記錄創作軌跡 · 驗證市場需求 · 探索無限可能
        </h1>

        {/* 核心願景引用句 */}
        <p className="mt-4 sm:mt-6 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          「此專案記錄我的創作並提供一個展示空間；藉此調查哪些產品受到喜愛，而且有潛在需求；也提供聯絡方式而有進一步交流的機會。」
        </p>

        {/* 統計指標卡片 */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
          {/* 指標 1 */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-indigo-400 mb-1">
              <Layers className="w-4 h-4" />
              <span className="text-xs text-slate-400">專案總進度</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {totalApps} <span className="text-xs text-slate-500 font-normal">/ 100</span>
            </div>
          </div>

          {/* 指標 2 */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-pink-400 mb-1">
              <Heart className="w-4 h-4 fill-pink-500/20" />
              <span className="text-xs text-slate-400">累計愛心讚數</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {totalLikes}
            </div>
          </div>

          {/* 指標 3 */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-cyan-400 mb-1">
              <Eye className="w-4 h-4" />
              <span className="text-xs text-slate-400">總體瀏覽人次</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {totalViews}
            </div>
          </div>

          {/* 指標 4 */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
              <MessageSquareQuote className="w-4 h-4" />
              <span className="text-xs text-slate-400">訪客許願回饋</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {totalFeedback}
            </div>
          </div>
        </div>

        {/* 快速滾動探索按鈕 */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onExploreClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors shadow-sm"
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            探索所有 App 作品
          </button>
        </div>
      </div>
    </section>
  );
};
