import React from 'react';

import type { FavoriteKind } from './FavoritesContext';
import { useParental } from './ParentalContext';

interface CategoryListProps {
  kind: FavoriteKind;
  categories: any[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export const CategoryList = ({ kind, categories, selected, onSelect }: CategoryListProps) => {
  const { hasPin, unlocked, isCategoryLocked, toggleCategoryLock } = useParental();
  return (
    <div className="w-64 flex-shrink-0 glass-panel p-4 rounded-xl overflow-y-auto border border-white/10">
      <h3 className="font-bold mb-4 text-lg text-white">Categories</h3>
      <div className="space-y-3">
        {categories.map((category) => {
          const id = String(category.category_id);
          const locked = isCategoryLocked(kind, id);
          return (
            <div key={id} className="flex items-stretch gap-1">
              <button
                onClick={() => onSelect(id)}
                className={`flex-1 min-w-0 text-left px-4 py-4 rounded-lg text-base font-medium transition-all
                  ${
                    selected === id
                      ? 'bg-gradient-to-r from-blue-500/60 to-blue-600/40 text-white border border-blue-400/50 shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                {locked && '🔒 '}
                {category.category_name}
              </button>
              {hasPin && unlocked && (
                <button
                  onClick={() => toggleCategoryLock(kind, id)}
                  title={locked ? 'Remove PIN lock' : 'Lock with PIN'}
                  className="px-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                >
                  {locked ? '🔓' : '🔒'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
