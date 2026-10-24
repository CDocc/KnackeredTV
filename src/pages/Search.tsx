import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PosterCard } from '../components/PosterCard';
import { FavoriteKind, useFavorites } from '../components/FavoritesContext';
import { useParental } from '../components/ParentalContext';
import { getCachedLibrary, getLibrary, searchList, Library } from '../utils/library';

interface SearchProps {
  profile: any;
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (kind: FavoriteKind, item: any) => void;
}

const SECTION_LIMIT = 24;

export const Search = ({ profile, query, onQueryChange, onOpen }: SearchProps) => {
  const { isFavorite, toggle } = useFavorites();
  const { isRestricted } = useParental();
  const [library, setLibrary] = useState<Library | null>(getCachedLibrary(profile.id));
  const [loading, setLoading] = useState(!getCachedLibrary(profile.id));
  const [debounced, setDebounced] = useState(query);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (getCachedLibrary(profile.id)) return;
    let cancelled = false;
    getLibrary(profile).then((lib) => {
      if (cancelled) return;
      setLibrary(lib);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setExpanded({}), [debounced]);

  const results = useMemo(() => {
    if (!library || !debounced.trim()) return null;
    const visible = (kind: FavoriteKind, items: any[]) =>
      searchList(items, debounced).filter((item) => !isRestricted(kind, item.categoryId));
    return {
      live: visible('live', library.live),
      movie: visible('movie', library.movie),
      series: visible('series', library.series),
    };
  }, [library, debounced, isRestricted]);

  const total = results ? results.live.length + results.movie.length + results.series.length : 0;

  const section = (kind: FavoriteKind, title: string, items: any[]) => {
    if (items.length === 0) return null;
    const shown = expanded[kind] ? items.slice(0, 300) : items.slice(0, SECTION_LIMIT);
    return (
      <section key={kind} className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-bold text-white">
            {title} <span className="text-sm font-normal text-white/50">{items.length}</span>
          </h3>
          {items.length > SECTION_LIMIT && (
            <button
              onClick={() => setExpanded((e) => ({ ...e, [kind]: !e[kind] }))}
              className="text-sm text-blue-300 hover:text-blue-200"
            >
              {expanded[kind] ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {kind === 'live' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {shown.map((ch) => (
              <div
                key={ch.id}
                className="group relative flex items-center gap-3 p-2 pr-10 rounded-lg bg-black/30 border border-white/10 hover:border-blue-400/50 transition-colors"
              >
                <button onClick={() => onOpen('live', ch)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className="w-14 h-14 rounded bg-black/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-contain"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    ) : (
                      <span className="text-2xl text-white/20">📺</span>
                    )}
                  </div>
                  <span className="text-sm text-white truncate">{ch.name}</span>
                </button>
                <button
                  onClick={() => toggle('live', ch.id, ch)}
                  className={`absolute top-1/2 -translate-y-1/2 right-3 text-xl transition-transform hover:scale-125 ${
                    isFavorite('live', ch.id) ? 'text-yellow-300' : 'text-white/60'
                  }`}
                  title={isFavorite('live', ch.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite('live', ch.id) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {shown.map((item) => (
              <PosterCard
                key={item.id}
                title={item.name}
                image={item.poster}
                rating={item.rating}
                favorite={isFavorite(kind, item.id)}
                onToggleFavorite={() => toggle(kind, item.id, item)}
                onClick={() => onOpen(kind, item)}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search channels, movies and series..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full glass-card px-4 py-3 rounded-lg text-base border border-white/10 focus:border-blue-400/50 outline-none"
      />

      <div className="flex-1 glass-panel p-6 rounded-xl overflow-y-auto border border-white/10">
        {loading ? (
          <div className="py-20 text-center text-white/60">
            <div className="animate-spin-slow mb-4 text-4xl">⟳</div>
            Loading your library for search...
            <div className="text-xs text-white/40 mt-2">This only happens once per session.</div>
          </div>
        ) : !results ? (
          <div className="py-20 text-center text-white/50">
            <div className="text-5xl mb-3">🔍</div>
            <p>Type to search all live channels, movies and series.</p>
            {library && (
              <p className="text-xs text-white/30 mt-2">
                {library.live.length.toLocaleString()} channels · {library.movie.length.toLocaleString()} movies ·{' '}
                {library.series.length.toLocaleString()} series
              </p>
            )}
          </div>
        ) : total === 0 ? (
          <div className="py-20 text-center text-white/50">No results for “{debounced}”</div>
        ) : (
          <>
            {section('live', 'Live TV', results.live)}
            {section('movie', 'Movies', results.movie)}
            {section('series', 'Series', results.series)}
          </>
        )}
      </div>
    </div>
  );
};
