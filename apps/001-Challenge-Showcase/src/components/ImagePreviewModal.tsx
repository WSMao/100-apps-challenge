import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appId: string;
  images: string[];
  initialIndex?: number;
  platform?: string;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  appName,
  appId,
  images,
  initialIndex = 0,
  platform = 'web',
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  // 鍵盤左右切換與 ESC 關閉
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length]);

  if (!isOpen || images.length === 0) return null;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const isMobile = ['ios', 'android', 'mobile'].includes(platform.toLowerCase());
  const currentImage = images[currentIndex] || images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      {/* 模糊背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* 視窗主容器 */}
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col z-10 select-none">
        {/* 頂部標題與關閉列 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl mb-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              #{appId}
            </span>
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              {appName} · 封面圖片預覽
            </h3>
            {images.length > 1 && (
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="關閉預覽"
            title="關閉 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 圖片預覽核心區 */}
        <div className="relative flex-1 flex items-center justify-center min-h-[400px] max-h-[75vh] p-2 sm:p-4 rounded-3xl bg-slate-950/70 border border-slate-800/80 overflow-hidden shadow-2xl">
          {/* 背景動態氛圍光暈 */}
          <img
            src={currentImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-125 pointer-events-none"
          />

          {/* 圖片主體：手機版呈現真實手機比例，桌面版呈現自適應比例 */}
          <div
            className={`relative flex items-center justify-center max-h-[70vh] transition-all duration-300 ${
              isMobile
                ? 'h-full aspect-[9/19.5] rounded-3xl overflow-hidden border-2 border-slate-700/80 shadow-2xl shadow-black ring-1 ring-white/10'
                : 'max-w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50'
            }`}
          >
            <img
              src={currentImage}
              alt={`${appName} 截圖 ${currentIndex + 1}`}
              className="w-full h-full object-contain"
            />
          </div>

          {/* 左切換按鈕 (多圖時顯示) */}
          {images.length > 1 && (
            <button
              onClick={handlePrev}
              className="absolute left-3 sm:left-6 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl backdrop-blur transition-all hover:scale-110 active:scale-95 cursor-pointer z-20"
              aria-label="上一張"
              title="上一張 (方向鍵左)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* 右切換按鈕 (多圖時顯示) */}
          {images.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-3 sm:right-6 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl backdrop-blur transition-all hover:scale-110 active:scale-95 cursor-pointer z-20"
              aria-label="下一張"
              title="下一張 (方向鍵右)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* 底部微縮圖切換列 (多圖時顯示) */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3 p-2 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                  idx === currentIndex
                    ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/30'
                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
