import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CategoryList } from '../components/CategoryList';
import { PosterCard } from '../components/PosterCard';
import { PosterGrid } from '../components/PosterGrid';
import { useFavorites } from '../components/FavoritesContext';
import { useParental } from '../components/ParentalContext';
import { VodPlayer, VodProgressTarget } from '../components/VodPlayer';
import { HistoryRow, formatTime, isResumable, loadHistory, vodUrl } from '../utils/vod';

interface MoviesProps {
  profile: any;
  initialSelected?: any;
}

interface MovieItem {
  id: string;
  name: string;
  poster: string;
  rating: number;
  ext: string;
}

interface PlayRequest {
  url: string;
  title: string;
  startTime: number;
  progress: VodProgressTarget;
}

const moviePlayRequest = (profile: any, movie: Pick<MovieItem, 'id' | 'name' | 'poster' | 'ext'>, startTime: number): PlayRequest => ({
  url: vodUrl(profile, 'movie', movie.id, movie.ext),
  title: movie.name,
  startTime,
  progress: {
    type: 'movie',
    contentId: movie.id,
    meta: { profileId: profile.id, kind: 'movie', id: movie.id, title: movie.name, image: movie.poster, ext: movie.ext },
  },
});

export const Movies = ({ profile, initialSelected }: MoviesProps) => {
  const { isFavorite, toggle } = useFavorites();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selected, setSelected] = useState<MovieItem | null>(initialSelected ?? null);
  const [playing, setPlaying] = useState<PlayRequest | null>(null);
  const requestId = useRef(0);

  const creds = useMemo(
    () => ({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password }),
    [profile]
  );

  const refreshHistory = useCallback(async () => {
    setHistory(await loadHistory('movie', profile.id));
  }, [profile.id]);

  useEffect(() => {
    (async () => {
      const result = await window.electron.ipcRenderer.invoke('get-movie-categories', creds);
      if (result.success) {
        const list = result.data || [];
        setCategories(list);
        if (list.length > 0) setSelectedCategory(String(list[0].category_id));
        else setLoading(false);
      } else {
        setError(result.error || 'Failed to load movie categories');
        setLoading(false);
      }
    })();
    refreshHistory();
  }, [creds, refreshHistory]);

  const { isRestricted, requestUnlock } = useParental();
  const restricted = isRestricted('movie', selectedCategory);

  useEffect(() => {
    if (!selectedCategory) return;
    const id = ++requestId.current;
    if (restricted) {
      setMovies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setSearch('');
    window.electron.ipcRenderer
      .invoke('get-movies', { ...creds, categoryId: selectedCategory })
      .then((result: any) => {
        if (id !== requestId.current) return;
        if (result.success) setMovies(result.data || []);
        else setError(result.error || 'Failed to load movies');
      })
      .catch((err: any) => id === requestId.current && setError(err.message))
      .finally(() => id === requestId.current && setLoading(false));
  }, [selectedCategory, creds, restricted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? movies.filter((m) => m.name.toLowerCase().includes(q)) : movies;
  }, [movies, search]);

  const resumable = useMemo(() => history.filter(isResumable), [history]);
  const historyById = useMemo(() => new Map(history.map((h) => [h.contentId, h])), [history]);

  const closePlayer = () => {
    setPlaying(null);
    refreshHistory();
  };

  if (playing) {
    return <VodPlayer {...playing} onClose={closePlayer} />;
  }

  if (selected) {
    return (
      <MovieDetail
        profile={profile}
        creds={creds}
        movie={selected}
        saved={historyById.get(selected.id)}
        onBack={() => setSelected(null)}
        onPlay={(info, startTime) =>
          setPlaying(moviePlayRequest(profile, { ...selected, ext: info?.ext || selected.ext, poster: info?.poster || selected.poster }, startTime))
        }
      />
    );
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <CategoryList kind="movie" categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

      <div className="flex-1 min-w-0 flex flex-col">
        <input
          type="text"
          placeholder="Search movies in this category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full glass-card px-4 py-3 mb-4 rounded-lg text-sm border border-white/10 focus:border-blue-400/50 outline-none"
        />

        <div className="flex-1 glass-panel p-6 rounded-xl overflow-y-auto border border-white/10">
          {resumable.length > 0 && !search && (
            <section className="mb-8">
              <h3 className="text-lg font-bold text-white mb-3">Continue watching</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {resumable.slice(0, 6).map((row) => (
                  <PosterCard
                    key={row.contentId}
                    title={row.meta.title}
                    image={row.meta.image}
                    subtitle={`${formatTime(row.position)} / ${formatTime(row.duration)}`}
                    progress={row.position / row.duration}
                    onClick={() =>
                      setPlaying(moviePlayRequest(profile, { id: row.meta.id, name: row.meta.title, poster: row.meta.image, ext: row.meta.ext }, row.position))
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4 text-red-200 text-sm">{error}</div>
          )}

          {restricted ? (
            <div className="py-20 text-center text-white/70">
              <div className="text-5xl mb-3">🔒</div>
              <p className="mb-4">This category is locked</p>
              <button onClick={() => requestUnlock()} className="glass-button px-5 py-2">
                Enter PIN
              </button>
            </div>
          ) : loading ? (
            <div className="py-20 text-center text-white/60">
              <div className="animate-spin-slow mb-4 text-4xl">⟳</div>
              Loading movies...
            </div>
          ) : filtered.length === 0 && !error ? (
            <div className="py-20 text-center text-white/60">No movies found</div>
          ) : (
            <PosterGrid
              items={filtered}
              getKey={(m) => m.id}
              render={(m) => (
                <PosterCard
                  title={m.name}
                  image={m.poster}
                  rating={m.rating}
                  favorite={isFavorite('movie', m.id)}
                  onToggleFavorite={() => toggle('movie', m.id, m)}
                  progress={isResumable(historyById.get(m.id)) ? historyById.get(m.id)!.position / historyById.get(m.id)!.duration : undefined}
                  onClick={() => setSelected(m)}
                />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface MovieDetailProps {
  profile: any;
  creds: any;
  movie: MovieItem;
  saved?: HistoryRow;
  onBack: () => void;
  onPlay: (info: any, startTime: number) => void;
}

const MovieDetail = ({ creds, movie, saved, onBack, onPlay }: MovieDetailProps) => {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.electron.ipcRenderer.invoke('get-movie-info', { ...creds, id: movie.id }).then((result: any) => {
      if (cancelled) return;
      if (result.success) setInfo(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [creds, movie.id]);

  const poster = info?.poster || movie.poster;
  const canResume = isResumable(saved);

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative min-h-full">
        {info?.backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm"
            style={{ backgroundImage: `url(${info.backdrop})` }}
          />
        )}
        <div className="relative p-8 max-w-5xl mx-auto">
          <button
            onClick={onBack}
            className="mb-6 px-4 py-2 rounded-lg glass-card border border-white/10 text-white/80 hover:text-white transition-colors"
          >
            ← Back
          </button>

          <div className="glass-panel rounded-xl border border-white/10 p-8 flex gap-8">
            <div className="w-64 flex-shrink-0">
              {poster ? (
                <img src={poster} alt={movie.name} className="w-full rounded-xl shadow-2xl" />
              ) : (
                <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold gradient-text mb-3">{movie.name}</h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-white/60 mb-5">
                {(info?.rating || movie.rating) > 0 && (
                  <span className="text-yellow-300 font-semibold">★ {(info?.rating || movie.rating).toFixed(1)}</span>
                )}
                {info?.year && <span>{String(info.year).slice(0, 4)}</span>}
                {info?.duration && <span>{info.duration}</span>}
                {info?.genre && <span>{info.genre}</span>}
              </div>

              <div className="flex gap-3 mb-6">
                {canResume && (
                  <button
                    onClick={() => onPlay(info, saved!.position)}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-400 hover:to-blue-500 transition-all"
                  >
                    ▶ Resume from {formatTime(saved!.position)}
                  </button>
                )}
                <button
                  onClick={() => onPlay(info, 0)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    canResume
                      ? 'glass-card border border-white/20 text-white/80 hover:text-white'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500'
                  }`}
                >
                  {canResume ? 'Start over' : '▶ Play'}
                </button>
              </div>

              {loading ? (
                <p className="text-white/40">Loading details...</p>
              ) : (
                <>
                  <p className="text-white/80 leading-relaxed mb-5">{info?.plot || 'No description available.'}</p>
                  {info?.director && (
                    <p className="text-sm text-white/60 mb-1"><span className="text-white/40">Director: </span>{info.director}</p>
                  )}
                  {info?.cast && (
                    <p className="text-sm text-white/60"><span className="text-white/40">Cast: </span>{info.cast}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
