import React from 'react';
import { Mail, Heart, Sparkles, Check } from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';

interface FooterProps {
  githubUrl?: string;
  contactEmail?: string;
  onOpenGuestbook: () => void;
  onShowToast: (msg: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  githubUrl = 'https://github.com/WSMao',
  contactEmail = 'wsm8236@gmail.com',
  onOpenGuestbook,
  onShowToast,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    onShowToast(`已複製 Email：${contactEmail}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-slate-950/80 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <div>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="font-bold text-slate-200 text-sm">100 Apps Challenge</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-indigo-400 font-mono">001-Challenge Showcase</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-md">
            用代碼記錄思考與探索，打造 100 款具備獨立質感、趣味性與實用價值的應用。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenGuestbook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-pink-300 bg-pink-950/30 hover:bg-pink-900/40 border border-pink-700/40 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>許願與交流留言板</span>
          </button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>

          <button
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Mail className="w-3.5 h-3.5" />}
            <span>{copied ? '已複製 Email' : 'Email 聯絡'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <p>© 2026 WSMao. All projects are open source and self-contained.</p>
        <p className="flex items-center gap-1">
          Made with <Heart className="w-3 h-3 text-pink-500 fill-pink-500" /> &amp; Antigravity Multi-Agent System
        </p>
      </div>
    </footer>
  );
};
