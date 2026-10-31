import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CategoryList } from '../components/CategoryList';
import { useParental } from '../components/ParentalContext';
import { SortReload } from '../components/SortReload';
import { SortKey, loadSort, saveSort, sortItems } from '../utils/sort';
import { clearLibrary } from '../utils/library';
import { PosterCard } from '../components/PosterCard';
import { useFavorites } from '../components/FavoritesContext';
import { PosterGrid } from '../components/PosterGrid';
import { VodPlayer, VodProgressTarget } from '../components/VodPlayer';
import { HistoryRow, formatTime, isResumable, loadHistory, vodUrl } from '../utils/vod';

interface SeriesProps {
  profile: any;
  initialSelected?: any;
}

interface SeriesItem {
  id: string;
  name: string;
  poster: string;
  plot: string;
  genre: string;
  year: string;
  rating: number;
  added?: number;
  backdrop: string;
}

interface EpisodeItem {
  id: string;
  season: number;
  episode: number;
  title: string;
  ext: string;
  plot: string;
  image: string;
  duration: string;
}

interface PlayRequest {
  url: string;
  title: string;
  startTime: number;
  progress: VodProgressTarget;
}

const pad = (n: number) => String(n).padStart(2, '0');

const episodeRequest = (
  profile: any,
  ep: { id: string; ext: string; title: string; image: string; seriesId: string; season: number; episode: number },
  startTime: number
): PlayRequest => ({
  url: vodUrl(profile, 'series', ep.id, ep.ext),
  title: ep.title,
  startTime,
  progress: {
    type: 'episode',
    contentId: ep.id,
    meta: {
      profileId: profile.id,
      kind: 'episode',
      id: ep.id,
      seriesId: ep.seriesId,
      season: ep.season,
      episode: ep.episode,
      title: ep.title,
      image: ep.image,
      ext: ep.ext,
    },
  },
});

export const Series = ({ profile, initialSelected }: SeriesProps) => {
  const { isFavorite, toggle } = useFavorites();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selected, setSelected] = useState<SeriesItem | null>(initialSelected ?? null);
  const [playing, setPlaying] = useState<PlayRequest | null>(null);
  const [sort, setSort] = useState<SortKey>(() => loadSort('series'));
  const [reloadTick, setReloadTick] = useState(0);
  const requestId = useRef(0);

  const changeSort = (key: SortKey) => {
    setSort(key);
    saveSort('series', key);
  };
  const reload = () => {
    clearLibrary(profile.id);
    setReloadTick((n) => n + 1);
  };

  const creds = useMemo(
    () => ({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password }),
    [profile]
  );

  const refreshHistory = useCallback(async () => {
    setHistory(await loadHistory('episode', profile.id));
  }, [profile.id]);

  useEffect(() => {
    (async () => {
      const result = await window.electron.ipcRenderer.invoke('get-series-categories', creds);
      if (result.success) {
        const list = result.data || [];
        setCategories(list);
        if (list.length > 0) setSelectedCategory(String(list[0].category_id));
        else setLoading(false);
      } else {
        setError(result.error || 'Failed to load series categories');
        setLoading(false);
      }
    })();
    refreshHistory();
  }, [creds, refreshHistory]);

  const { isRestricted, requestUnlock } = useParental();
  const restricted = isRestricted('series', selectedCategory);

  useEffect(() => {
    if (!selectedCategory) return;
    const id = ++requestId.current;
    if (restricted) {
      setSeriesList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setSearch('');
    window.electron.ipcRenderer
      .invoke('get-series', { ...creds, categoryId: selectedCategory })
      .then((result: any) => {
        if (id !== requestId.current) return;
        if (result.success) setSeriesList(result.data || []);
        else setError(result.error || 'Failed to load series');
      })
      .catch((err: any) => id === requestId.current && setError(err.message))
      .finally(() => id === requestId.current && setLoading(false));
  }, [selectedCategory, creds, restricted, reloadTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortItems(q ? seriesList.filter((s) => s.name.toLowerCase().includes(q)) : seriesList, sort);
  }, [seriesList, search, sort]);

  const resumable = useMemo(() => history.filter(isResumable), [history]);

  const playFromHistory = (row: HistoryRow) =>
    setPlaying(episodeRequest(profile, { ...row.meta, seriesId: row.meta.seriesId }, row.position));

  const closePlayer = () => {
    setPlaying(null);
    refreshHistory();
  };

  if (playing) {
    return <VodPlayer {...playing} onClose={closePlayer} />;
  }

  if (selected) {
    return (
      <SeriesDetail
        profile={profile}
        creds={creds}
        series={selected}
        history={history.filter((h) => h.meta?.seriesId === selected.id)}
        onBack={() => setSelected(null)}
        onPlay={setPlaying}
      />
    );
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <CategoryList kind="series" categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search series in this category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 glass-card px-4 py-3 rounded-lg text-sm border border-white/10 focus:border-blue-400/50 outline-none"
          />
          <SortReload sort={sort} onSort={changeSort} onReload={reload} loading={loading} />
        </div>

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
                    onClick={() => playFromHistory(row)}
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
              Loading series...
            </div>
          ) : filtered.length === 0 && !error ? (
            <div className="py-20 text-center text-white/60">No series found</div>
          ) : (
            <PosterGrid
              items={filtered}
              getKey={(s) => s.id}
              render={(s) => (
                <PosterCard title={s.name} image={s.poster} rating={s.rating} subtitle={s.year ? String(s.year).slice(0, 4) : undefined} favorite={isFavorite('series', s.id)} onToggleFavorite={() => toggle('series', s.id, s)} onClick={() => setSelected(s)} />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface SeriesDetailProps {
  profile: any;
  creds: any;
  series: SeriesItem;
  history: HistoryRow[];
  onBack: () => void;
  onPlay: (request: PlayRequest) => void;
}

const SeriesDetail = ({ profile, creds, series, history, onBack, onPlay }: SeriesDetailProps) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [season, setSeason] = useState<number | null>(null);

  const historyById = useMemo(() => new Map(history.map((h) => [h.contentId, h])), [history]);
  // History is ordered newest first, so the first resumable row is the most recent episode
  const continueRow = history.find(isResumable);

  useEffect(() => {
    let cancelled = false;
    window.electron.ipcRenderer.invoke('get-series-info', { ...creds, id: series.id }).then((result: any) => {
      if (cancelled) return;
      if (result.success) {
        setData(result.data);
        const seasons: number[] = result.data.seasons;
        setSeason(continueRow?.meta?.season && seasons.includes(continueRow.meta.season) ? continueRow.meta.season : seasons[0] ?? null);
      } else {
        setError(result.error || 'Failed to load series details');
      }
    });
    return () => {
      cancelled = true;
    };
    // continueRow is only used for the initial season choice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds, series.id]);

  const info = data?.info;
  const poster = info?.poster || series.poster;
  const episodes: EpisodeItem[] = season !== null && data ? data.episodes[season] || [] : [];

  const play = (ep: EpisodeItem, startTime: number) =>
    onPlay(
      episodeRequest(
        profile,
        {
          id: ep.id,
          ext: ep.ext,
          title: `${series.name} · S${pad(ep.season)}E${pad(ep.episode)} · ${ep.title}`,
          image: ep.image || poster,
          seriesId: series.id,
          season: ep.season,
          episode: ep.episode,
        },
        startTime
      )
    );

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative min-h-full">
        {(info?.backdrop || series.backdrop) && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm"
            style={{ backgroundImage: `url(${info?.backdrop || series.backdrop})` }}
          />
        )}
        <div className="relative p-8 max-w-5xl mx-auto">
          <button
            onClick={onBack}
            className="mb-6 px-4 py-2 rounded-lg glass-card border border-white/10 text-white/80 hover:text-white transition-colors"
          >
            ← Back
          </button>

          <div className="glass-panel rounded-xl border border-white/10 p-8 flex gap-8 mb-6">
            <div className="w-56 flex-shrink-0">
              {poster ? (
                <img src={poster} alt={series.name} className="w-full rounded-xl shadow-2xl" />
              ) : (
                <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold gradient-text mb-3">{series.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/60 mb-5">
                {(info?.rating || series.rating) > 0 && (
                  <span className="text-yellow-300 font-semibold">★ {(info?.rating || series.rating).toFixed(1)}</span>
                )}
                {(info?.year || series.year) && <span>{String(info?.year || series.year).slice(0, 4)}</span>}
                {(info?.genre || series.genre) && <span>{info?.genre || series.genre}</span>}
              </div>

              {continueRow && (
                <button
                  onClick={() =>
                    onPlay(episodeRequest(profile, { ...continueRow.meta, seriesId: series.id }, continueRow.position))
                  }
                  className="mb-5 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-400 hover:to-blue-500 transition-all"
                >
                  ▶ Continue S{pad(continueRow.meta.season)}E{pad(continueRow.meta.episode)} · {formatTime(continueRow.position)}
                </button>
              )}

              <p className="text-white/80 leading-relaxed mb-4">{info?.plot || series.plot || 'No description available.'}</p>
              {info?.cast && (
                <p className="text-sm text-white/60"><span className="text-white/40">Cast: </span>{info.cast}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4 text-red-200 text-sm">{error}</div>
          )}

          {!data && !error && <div className="py-10 text-center text-white/60">Loading episodes...</div>}

          {data && data.seasons.length === 0 && (
            <div className="py-10 text-center text-white/60">No episodes available</div>
          )}

          {data && data.seasons.length > 0 && (
            <div className="glass-panel rounded-xl border border-white/10 p-6">
              <div className="flex flex-wrap gap-2 mb-5">
                {data.seasons.map((s: number) => (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      season === s
                        ? 'bg-gradient-to-r from-blue-500/60 to-blue-600/40 text-white border border-blue-400/50'
                        : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    Season {s}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {episodes.map((ep) => {
                  const saved = historyById.get(ep.id);
                  const resumable = isResumable(saved);
                  return (
                    <button
                      key={ep.id}
                      onClick={() => play(ep, resumable ? saved!.position : 0)}
                      className="w-full flex gap-4 items-center p-3 rounded-lg text-left bg-black/20 border border-white/5 hover:border-blue-400/50 hover:bg-white/5 transition-all"
                    >
                      <div className="relative w-36 aspect-video flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                        {ep.image && (
                          <img
                            src={ep.image}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                          />
                        )}
                        {resumable && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-blue-400" style={{ width: `${(saved!.position / saved!.duration) * 100}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {ep.episode}. {ep.title}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">
                          {ep.duration}
                          {saved?.watched ? <span className="ml-2 text-green-400">✓ Watched</span> : null}
                          {resumable ? <span className="ml-2 text-blue-300">Resume {formatTime(saved!.position)}</span> : null}
                        </div>
                        {ep.plot && <p className="text-sm text-white/60 mt-1 line-clamp-2">{ep.plot}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
