import React from 'react';
import { SORT_OPTIONS, SortKey } from '../utils/sort';

interface SortReloadProps {
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onReload: () => void;
  loading: boolean;
}

export const SortReload = ({ sort, onSort, onReload, loading }: SortReloadProps) => (
  <div className="flex gap-2 shrink-0">
    <select
      value={sort}
      onChange={(e) => onSort(e.target.value as SortKey)}
      title="Sort by"
      className="glass-card px-3 py-3 rounded-lg text-sm border border-white/10 outline-none focus:border-blue-400/50 bg-transparent text-white"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.key} value={o.key} className="bg-slate-900">
          {o.label}
        </option>
      ))}
    </select>
    <button
      onClick={onReload}
      disabled={loading}
      title="Reload this category from the server"
      className="glass-button px-4 py-3 text-sm disabled:opacity-50"
    >
      <span className={loading ? 'inline-block animate-spin-slow' : ''}>⟳</span> Reload
    </button>
  </div>
);
