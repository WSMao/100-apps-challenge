import React, { useState } from 'react';
import { X, MessageSquare, Send, Sparkles, User, MessageCircleHeart } from 'lucide-react';
import type { AppManifest, GuestbookEntry } from '../types/app';
import { addGuestbookComment, getGuestbookList } from '../services/appService';

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
  const [entries, setEntries] = useState<GuestbookEntry[]>(() => getGuestbookList());
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId || '');

  // 當 defaultAppId 變更時同步
  React.useEffect(() => {
    if (defaultAppId) {
      setSelectedAppId(defaultAppId);
    }
  }, [defaultAppId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const matchedApp = apps.find(a => a.id === selectedAppId);

    addGuestbookComment({
      author: author.trim() || '熱心訪客',
      content: content.trim(),
      appId: selectedAppId || undefined,
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
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* 頂部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <MessageCircleHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-lg">許願與回饋留言板</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-medium">
                  {entries.length} 則交流
                </span>
              </div>
              <p className="text-xs text-slate-400">留下你對某個作品的喜愛、功能建議或未來想看的小工具！</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區：發表表單 + 歷史留言列表 */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 發布回饋表單 */}
          <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>我有想法 / 想要許願</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">暱稱 / 稱呼（選填）</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="匿名訪客 / GitHub ID"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">關聯作品（選填）</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">全站總體回饋 / 許願全新 App</option>
                  {apps.map(app => (
                    <option key={app.id} value={app.id}>
                      #{app.id} {app.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">留言或許願內容 *</label>
              <textarea
                required
                rows={3}
                placeholder="覺得哪個 App 很有潛力？或是希望我下一個 App 挑戰做什麼功能？"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 shadow-md shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              所有訪客反饋與許願
            </h4>

            {entries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                尚無留言，成為第一個留下想法的人吧！
              </div>
            ) : (
              entries.map((item) => (
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

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>數據同步存儲於瀏覽器，未來可平滑升級串接 Giscus / 雲端 API</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
