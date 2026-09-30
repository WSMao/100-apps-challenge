import React from 'react';
import { Search, Tag, X } from 'lucide-react';
import type { AppStatus } from '../types/app';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStatus: 'all' | AppStatus;
  onStatusChange: (status: 'all' | AppStatus) => void;
  availableTags: string[];
  tagCounts: Map<string, number>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onResetFilters: () => void;
  totalFiltered: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  availableTags,
  tagCounts,
  selectedTags,
  onToggleTag,
  onResetFilters,
  totalFiltered,
}) => {
  const hasActiveFilters = searchQuery !== '' || selectedStatus !== 'all' || selectedTags.length > 0;

  return (
    <div className="space-y-4 mb-8">
      {/* 搜尋列與狀態篩選 */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* 搜尋框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="搜尋 App 編號、名稱、技術或關鍵字..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 狀態切換器 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => onStatusChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedStatus === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部作品
          </button>
          <button
            onClick={() => onStatusChange('in-progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedStatus === 'in-progress'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            進行中
          </button>
          <button
            onClick={() => onStatusChange('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedStatus === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            已完成
          </button>
        </div>
      </div>

      {/* 標籤 Tag 快速過濾列（支援多選、依使用數量由多到少排序） */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
          <Tag className="w-3.5 h-3.5" />
          <span>標籤（可多選）：</span>
        </div>

        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const count = tagCounts.get(tag) || 0;
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/60 shadow-sm shadow-indigo-500/20 font-semibold'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
              title={`點擊${isSelected ? '取消篩選' : '加入篩選'} #${tag}（共 ${count} 個 App 使用）`}
            >
              <span>#{tag}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-indigo-500/30 text-indigo-100' : 'bg-slate-800 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 ml-auto text-xs text-slate-400 hover:text-pink-400 transition-colors py-1 px-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            重設篩選 ({totalFiltered} 個結果)
          </button>
        )}
      </div>
    </div>
  );
};
