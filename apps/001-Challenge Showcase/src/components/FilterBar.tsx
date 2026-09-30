import React from 'react';
import { Search, Tag, X } from 'lucide-react';
import type { AppStatus } from '../types/app';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStatus: 'all' | AppStatus;
  onStatusChange: (status: 'all' | AppStatus) => void;
  availableTags: string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  totalFiltered: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  availableTags,
  selectedTag,
  onTagSelect,
  totalFiltered,
}) => {
  const hasActiveFilters = searchQuery !== '' || selectedStatus !== 'all' || selectedTag !== null;

  const handleReset = () => {
    onSearchChange('');
    onStatusChange('all');
    onTagSelect(null);
  };

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
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 狀態切換器 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => onStatusChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部作品
          </button>
          <button
            onClick={() => onStatusChange('in-progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === 'in-progress'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            進行中
          </button>
          <button
            onClick={() => onStatusChange('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            已完成
          </button>
        </div>
      </div>

      {/* 標籤 Tag 快速過濾列 */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
          <Tag className="w-3.5 h-3.5" />
          <span>標籤：</span>
        </div>

        {availableTags.map((tag) => {
          const isSelected = selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => onTagSelect(isSelected ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                isSelected
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              #{tag}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 ml-auto text-xs text-slate-400 hover:text-pink-400 transition-colors py-1 px-2"
          >
            <X className="w-3.5 h-3.5" />
            重設篩選 ({totalFiltered} 個結果)
          </button>
        )}
      </div>
    </div>
  );
};
