import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Sparkles, User, MessageCircleHeart, Lock, Globe, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import Giscus from '@giscus/react';
import type { AppManifest } from '../types/app';
import { sendGuestCommentToGithub } from '../services/appService';
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
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  // 用於刷新 Giscus 的隨機 key
  const [giscusRefreshKey, setGiscusRefreshKey] = useState(0);

  // 當 defaultAppId 變更時同步設定
  useEffect(() => {
    setSelectedAppId(defaultAppId || '');
    setSubmitStatus(null);
  }, [defaultAppId, isOpen]);

  // 是否為特定 App 觸發的專屬回饋視窗
  const isSpecificApp = Boolean(defaultAppId);
  const targetApp = useMemo(() => apps.find((a) => a.id === defaultAppId), [apps, defaultAppId]);

  // 當前 Giscus 對應的 term (Specific mapping)
  // 全站留言的 term 使用 "global"
  const currentAppId = isSpecificApp ? defaultAppId : selectedAppId;
  const currentTerm = currentAppId ? `app-${currentAppId}` : 'global';
  const currentAppName = useMemo(() => {
    if (!currentAppId) return '全站總體交流 (global)';
    const found = apps.find((a) => a.id === currentAppId);
    return found ? `#${found.id} ${found.name}` : `App #${currentAppId}`;
  }, [currentAppId, apps]);

  if (!isOpen) return null;

  const handleSubmitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus(null);

    const res = await sendGuestCommentToGithub({
      term: currentTerm,
      author: author.trim() || '匿名訪客',
      content: content.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmitStatus({
        type: 'success',
        message: '留言已成功送出！正在載入至討論串...',
      });
      setContent('');
      if (onAddedEntry) onAddedEntry();

      // 觸發 Giscus 重新渲染以拉取最新討論內容
      setTimeout(() => {
        setGiscusRefreshKey((prev) => prev + 1);
      }, 1200);

      // 3 秒後自動隱藏成功提示
      setTimeout(() => {
        setSubmitStatus(null);
      }, 4000);
    } else {
      setSubmitStatus({
        type: 'error',
        message: res.message || '發送失敗，請稍後再試',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* 遮罩 */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 容器 */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200">
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

        {/* 頂部資訊與範圍選擇器 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              討論主題：<strong className="text-slate-100">{currentAppName}</strong>
            </span>
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
                onChange={(e) => {
                  setSelectedAppId(e.target.value);
                  setSubmitStatus(null);
                }}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">全站總體回饋 (global)</option>
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 訪客免帳號留言摺疊按鈕 / 區塊 */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowGuestForm(!showGuestForm)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>沒有 GitHub 帳號？使用「訪客免登入快速留言」</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                <span>{showGuestForm ? '收合表單' : '展開輸入框'}</span>
                {showGuestForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showGuestForm && (
              <form onSubmit={handleSubmitGuest} className="p-4 pt-2 border-t border-slate-700/60 space-y-3 bg-slate-900/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">暱稱 / 稱呼（選填）</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="例如：熱心訪客 / 王小明"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">發送目標討論串</label>
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
                    disabled={isSubmitting}
                  />
                </div>

                {submitStatus && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
                      submitStatus.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {submitStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{submitStatus.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">
                    💡 留言將由 GitHub Bot 自動投遞至該討論串中，全球永久同步。
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        發送中...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        免帳號送出
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 唯一的 Giscus 留言討論串（登入 GitHub 直接留，免帳號送出後也同步顯示在這裡） */}
          <div className="min-h-[420px] p-3 sm:p-5 rounded-xl bg-slate-950/40 border border-slate-800/70 overflow-hidden">
            <Giscus
              key={`${currentTerm}-${giscusRefreshKey}`}
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
