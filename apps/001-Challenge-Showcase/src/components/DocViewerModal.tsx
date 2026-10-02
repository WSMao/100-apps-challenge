import React, { useMemo } from 'react';
import { X, BookOpen, ExternalLink, Copy, Check } from 'lucide-react';
import { marked } from 'marked';

interface DocViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appId: string;
  markdownContent: string;
  demoUrl?: string;
  docUrl?: string;
}

export const DocViewerModal: React.FC<DocViewerModalProps> = ({
  isOpen,
  onClose,
  appName,
  appId,
  markdownContent,
  demoUrl,
  docUrl,
}) => {
  const [copied, setCopied] = React.useState(false);

  // 解析 Markdown 為安全 HTML
  const parsedHtml = useMemo(() => {
    try {
      return marked.parse(markdownContent, { async: false }) as string;
    } catch (e) {
      console.error('Failed to parse markdown:', e);
      return '<p>Markdown 解析失敗</p>';
    }
  }, [markdownContent]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 視窗容器 */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* 頂部標題列 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  #{appId}
                </span>
                <h3 className="font-semibold text-slate-100 text-lg">{appName}</h3>
              </div>
              <p className="text-xs text-slate-400">專案技術說明文件 · README.md</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 cursor-pointer"
              title="複製原始 Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已複製' : '複製 Markdown'}
            </button>

            {demoUrl && (
              <a
                href={demoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-500/20"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                開啟 Demo
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              aria-label="關閉視窗"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 內文區域 */}
        <div className="p-6 sm:p-8 overflow-y-auto text-slate-300 space-y-4 text-sm leading-relaxed prose prose-invert prose-indigo max-w-none">
          <div 
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: parsedHtml }} 
          />
        </div>

        {/* 底部功能列 */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>文件格式：GitHub Flavored Markdown</span>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                <span>在 GitHub 查看原始檔案</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
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
