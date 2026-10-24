import React, { useState } from 'react';
import { PosterCard } from '../components/PosterCard';
import { FavoriteKind, useFavorites } from '../components/FavoritesContext';
import { useParental } from '../components/ParentalContext';

interface FavoritesProps {
  onOpen: (kind: FavoriteKind, item: any) => void;
}

const TABS: { kind: FavoriteKind; label: string }[] = [
  { kind: 'live', label: 'Live TV' },
  { kind: 'movie', label: 'Movies' },
  { kind: 'series', label: 'Series' },
];

export const Favorites = ({ onOpen }: FavoritesProps) => {
  const { favorites: allFavorites, toggle } = useFavorites();
  const { isRestricted } = useParental();
  const favorites = allFavorites.filter((f) => !isRestricted(f.kind, f.data?.categoryId));
  const [tab, setTab] = useState<FavoriteKind>('live');
  const items = favorites.filter((f) => f.kind === tab);

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className="flex gap-2">
        {TABS.map(({ kind, label }) => {
          const count = favorites.filter((f) => f.kind === kind).length;
          return (
            <button
              key={kind}
              onClick={() => setTab(kind)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all border ${
                tab === kind
                  ? 'bg-gradient-to-r from-blue-500/60 to-blue-600/40 text-white border-blue-400/50'
                  : 'text-white/70 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              {label} <span className="text-white/50 text-sm ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 glass-panel p-6 rounded-xl overflow-y-auto border border-white/10">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50">
            <div className="text-5xl mb-3">☆</div>
            <p>No favorites yet. Click the star on any channel, movie or series to add it here.</p>
          </div>
        ) : tab === 'live' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {items.map((f) => (
              <div
                key={f.itemId}
                className="group relative rounded-lg overflow-hidden bg-black/30 border border-white/10 hover:border-blue-400/50 transition-colors"
              >
                <button onClick={() => onOpen('live', f.data)} className="block w-full text-left">
                  <div className="relative w-full aspect-video bg-black/50 overflow-hidden">
                    {f.data.logo ? (
                      <img
                        src={f.data.logo}
                        alt={f.data.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                        <span className="text-3xl text-white/20">📺</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-gradient-to-t from-black/60 to-black/20">
                    <h4 className="font-semibold text-sm text-white truncate">{f.data.name}</h4>
                  </div>
                </button>
                <button
                  onClick={() => toggle('live', f.itemId, f.data)}
                  className="absolute top-2 right-2 text-xl text-yellow-300 transition-transform hover:scale-125 drop-shadow-lg"
                  title="Remove from favorites"
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {items.map((f) => (
              <PosterCard
                key={f.itemId}
                title={f.data.name}
                image={f.data.poster}
                rating={f.data.rating}
                favorite
                onToggleFavorite={() => toggle(tab, f.itemId, f.data)}
                onClick={() => onOpen(tab, f.data)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
