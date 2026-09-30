import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageSquare, Send, Sparkles, User, MessageCircleHeart, Lock, Globe } from 'lucide-react';
import Giscus from '@giscus/react';
import type { AppManifest, GuestbookEntry } from '../types/app';
import { addGuestbookComment, getGuestbookList } from '../services/appService';
import { GithubIcon } from './icons/GithubIcon';

interface GuestbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppManifest[];
  defaultAppId?: string;
  onAddedEntry?: () => void;
}

export const GuestbookModal: React.FC<GuestbookModalProps> = ({
  isOpen,
  onClose,
  apps,
  defaultAppId,
  onAddedEntry,
}) => {
  const [activeTab, setActiveTab] = useState<'giscus' | 'local'>('giscus');
  const [entries, setEntries] = useState<GuestbookEntry[]>(() => getGuestbookList());
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId || '');

  // 當 defaultAppId 變更時同步設定
  useEffect(() => {
    setSelectedAppId(defaultAppId || '');
  }, [defaultAppId, isOpen]);

  // 是否為特定 App 觸發的專屬回饋視窗
  const isSpecificApp = Boolean(defaultAppId);
  const targetApp = useMemo(() => apps.find((a) => a.id === defaultAppId), [apps, defaultAppId]);

  // 當前 Giscus 對應的 term (Specific mapping)
  const currentAppId = isSpecificApp ? defaultAppId : selectedAppId;
  const currentTerm = currentAppId ? `app-${currentAppId}` : 'showcase-global';
  const currentAppName = useMemo(() => {
    if (!currentAppId) return '全站總體交流';
    const found = apps.find((a) => a.id === currentAppId);
    return found ? `#${found.id} ${found.name}` : `App #${currentAppId}`;
  }, [currentAppId, apps]);

  // 過濾本機留言清單：若是特定 App 則只顯示關聯該 App 的回饋；全域視窗則顯示全部
  const displayEntries = useMemo(() => {
    if (isSpecificApp && defaultAppId) {
      return entries.filter((e) => e.appId === defaultAppId);
    }
    return entries;
  }, [entries, isSpecificApp, defaultAppId]);

  if (!isOpen) return null;

  const handleSubmitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const actualAppId = isSpecificApp ? defaultAppId : selectedAppId;
    const matchedApp = apps.find((a) => a.id === actualAppId);

    addGuestbookComment({
      author: author.trim() || '熱心訪客',
      content: content.trim(),
      appId: actualAppId || undefined,
      appName: matchedApp ? `#${matchedApp.id} ${matchedApp.name}` : undefined,
    });

    setEntries(getGuestbookList());
    setContent('');
    if (onAddedEntry) onAddedEntry();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* 遮罩 */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 容器 */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* 頂部標題 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <MessageCircleHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-lg">
                  {isSpecificApp && targetApp
                    ? `#${targetApp.id} ${targetApp.name} · 作品回饋`
                    : '許願與回饋留言板'}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-medium border border-indigo-500/30">
                  {currentTerm}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSpecificApp && targetApp
                  ? `針對「${targetApp.name}」留下你的評價、喜愛之處或功能建議！`
                  : '留下你對作品的喜愛、功能建議或未來想看的小工具！'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 分頁切換器 (Giscus GitHub Discussions vs 訪客免帳號留言) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('giscus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'giscus'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub 討論區 (全網即時同步)</span>
            </button>

            <button
              onClick={() => setActiveTab('local')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-pink-600 text-white shadow-sm shadow-pink-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>訪客免帳號留言 ({displayEntries.length})</span>
            </button>
          </div>

          {/* 關聯作品選擇器 (僅在全域視窗可切換) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-slate-500 text-[11px]">討論範圍：</span>
            {isSpecificApp && targetApp ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                <Lock className="w-3 h-3 text-indigo-400" />
                已鎖定 #{targetApp.id} {targetApp.name}
              </span>
            ) : (
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">全站總體回饋</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    #{app.id} {app.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 內容區 */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'giscus' ? (
            /* Tab 1: Giscus GitHub Discussions 核心串接 */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 bg-slate-800/40 px-4 py-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    當前討論主題：<strong className="text-slate-200">{currentAppName}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  登入 GitHub 即可發言、按 Emoji 反應 👍
                </span>
              </div>

              {/* Giscus 組件 (依據 currentTerm 自動隔離切換) */}
              <div className="min-h-[400px] p-3 sm:p-5 rounded-xl bg-slate-950/40 border border-slate-800/70 overflow-hidden">
                <Giscus
                  key={currentTerm}
                  id="comments"
                  repo="WSMao/100-apps-challenge"
                  repoId="R_kgDOU1naVA"
                  category="General"
                  categoryId="DIC_kwDOU1naVM4DGwMC"
                  mapping="specific"
                  term={currentTerm}
                  reactionsEnabled="1"
                  emitMetadata="0"
                  inputPosition="top"
                  theme="dark_dimmed"
                  lang="zh-TW"
                  loading="eager"
                />
              </div>
            </div>
          ) : (
            /* Tab 2: 訪客免帳號留言 (本地快速留言) */
            <div className="space-y-6">
              {/* 發布回饋表單 */}
              <form onSubmit={handleSubmitLocal} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>
                    {isSpecificApp && targetApp
                      ? `向作者回饋 #${targetApp.id} ${targetApp.name}`
                      : '我有想法 / 想要許願'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">暱稱 / 稱呼（選填）</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="匿名訪客 / 稱呼"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">關聯作品</label>
                    <div className="flex items-center px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-xs text-slate-300">
                      <span className="truncate">{currentAppName}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">留言內容 *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder={
                      isSpecificApp && targetApp
                        ? `覺得 #${targetApp.id} 的體驗如何？希望增加什麼延伸功能？`
                        : '覺得哪個 App 很有潛力？或是希望我下一個 App 挑戰做什麼功能？'
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 shadow-md shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    送出回饋
                  </button>
                </div>
              </form>

              {/* 留言列表 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isSpecificApp && targetApp
                    ? `「#${targetApp.id} ${targetApp.name}」訪客反饋 (${displayEntries.length})`
                    : `所有訪客反饋與許願 (${displayEntries.length})`}
                </h4>

                {displayEntries.length === 0 ? (
                  <div className="text-center py-8 rounded-xl bg-slate-800/20 border border-slate-800 text-slate-500 text-xs">
                    {isSpecificApp
                      ? '此作品目前尚無訪客反饋，成為第一個給予評價或建議的人吧！'
                      : '尚無留言，成為第一個留下想法的人吧！'}
                  </div>
                ) : (
                  displayEntries.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-200">{item.author}</span>
                          {item.appName && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                              {item.appName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{item.createdAt}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <GithubIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>由 GitHub Discussions 提供技術支援 · 全球永久同步</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
