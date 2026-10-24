import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import type { Channel } from '../types';
import { useFavorites } from '../components/FavoritesContext';
import { useParental } from '../components/ParentalContext';
import { getCachedLibrary, getLibrary, searchList } from '../utils/library';

const VOLUME_KEY = 'knackeredtv.volume';
const MAX_SLOTS = 4;
const MAX_RETRIES = 3;

const loadVolume = () => {
  const saved = parseFloat(localStorage.getItem(VOLUME_KEY) || '');
  return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.5;
};

interface TileProps {
  channel: Channel;
  active: boolean;
  onFocus: () => void;
  onRemove: () => void;
  onExpand: () => void;
}

// A small live player: only the focused tile has sound, and buffers are kept small
const MultiViewTile = ({ channel, active, onFocus, onRemove, onExpand }: TileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const urls = useMemo(
    () => [channel.streamUrl, ...(channel.alternateUrls || [])].filter(Boolean),
    [channel.streamUrl, channel.alternateUrls]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let hls: any = null;
    let ts: any = null;
    let retries = 0;
    let index = 0;
    setStatus('loading');

    const teardown = () => {
      hls?.destroy();
      ts?.destroy();
      hls = ts = null;
      video.removeAttribute('src');
      video.load();
    };
    const fail = () => {
      if (disposed) return;
      teardown();
      if (index < urls.length - 1) {
        index++;
        retries = 0;
        start();
      } else {
        setStatus('error');
      }
    };
    const retryOrFail = (retry: () => void) => {
      if (disposed) return;
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(() => !disposed && retry(), 1000 * retries);
      } else {
        fail();
      }
    };
    const play = () => video.play().catch(() => {});

    function start() {
      const url = urls[index];
      if (!url) return fail();
      if (/\.m3u8(\?|$)/i.test(url) && Hls.isSupported()) {
        hls = new Hls({ backBufferLength: 10, maxBufferLength: 10, maxMaxBufferLength: 20, enableWorker: true });
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) retryOrFail(() => hls.startLoad());
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) retryOrFail(() => hls.recoverMediaError());
          else fail();
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (/\.ts(\?|$)/i.test(url) && mpegts.isSupported()) {
        const load = () => {
          ts?.destroy();
          ts = mpegts.createPlayer(
            { type: 'mpegts', isLive: true, url },
            {
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 10,
              autoCleanupMinBackwardDuration: 5,
              liveSync: true,
              liveSyncMaxLatency: 8,
              liveSyncTargetLatency: 4,
              lazyLoad: false,
            }
          );
          ts.on(mpegts.Events.ERROR, () => retryOrFail(load));
          ts.attachMediaElement(video);
          ts.load();
          play();
        };
        load();
      } else {
        video.addEventListener('error', fail, { once: true });
        video.src = url;
        play();
      }
    }

    const onPlaying = () => {
      retries = 0;
      setStatus('playing');
    };
    video.addEventListener('playing', onPlaying);
    start();

    return () => {
      disposed = true;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', fail);
      teardown();
    };
  }, [urls, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !active;
    video.volume = loadVolume();
  }, [active, status]);

  return (
    <div
      onClick={onFocus}
      className={`relative bg-black rounded-lg overflow-hidden border-2 group ${
        active ? 'border-blue-400' : 'border-white/10'
      }`}
    >
      <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
      <div className="absolute top-0 inset-x-0 p-2 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent text-sm text-white">
        <span className="truncate flex-1">
          {active ? '🔊 ' : '🔇 '}
          {channel.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          title="Watch full screen"
          className="opacity-0 group-hover:opacity-100 px-1.5 hover:text-blue-300"
        >
          ⛶
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
          className="opacity-0 group-hover:opacity-100 px-1.5 hover:text-red-300"
        >
          ✕
        </button>
      </div>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 pointer-events-none">
          <span className="animate-spin-slow text-3xl">⟳</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm text-white/80">
          <span>Stream unavailable (check your connection limit)</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAttempt((n) => n + 1);
            }}
            className="glass-button px-3 py-1"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

interface MultiViewProps {
  profile: any;
  onExpand: (channel: Channel) => void;
}

export const MultiView = ({ profile, onExpand }: MultiViewProps) => {
  const storageKey = `knackeredtv.multiview.${profile.id}`;
  const { favorites } = useFavorites();
  const { isRestricted, requestUnlock } = useParental();
  const [live, setLive] = useState<Channel[]>(getCachedLibrary(profile.id)?.live ?? []);
  const [layout, setLayout] = useState<2 | 4>(4);
  const [slots, setSlots] = useState<(string | null)[]>(Array(MAX_SLOTS).fill(null));
  const [activeSlot, setActiveSlot] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Only channel ids are remembered; stream URLs (with credentials) are resolved from the library
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved) {
        setLayout(saved.layout === 2 ? 2 : 4);
        setSlots(Array.from({ length: MAX_SLOTS }, (_, i) => (saved.slots?.[i] ? String(saved.slots[i]) : null)));
      }
    } catch {}
    setLoaded(true);
    getLibrary(profile).then((lib) => setLive(lib.live));
  }, [profile.id]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify({ layout, slots }));
  }, [layout, slots, loaded]);

  const byId = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const f of favorites) if (f.kind === 'live') map.set(f.itemId, f.data);
    for (const c of live) map.set(String(c.id), c);
    return map;
  }, [live, favorites]);

  const maxConnections = Number(profile.accountInfo?.max_connections) || 0;
  const filled = slots.slice(0, layout).filter(Boolean).length;

  const setSlot = (index: number, id: string | null) =>
    setSlots((prev) => prev.map((s, i) => (i === index ? id : s)));

  const pickerResults = useMemo(() => {
    if (pickerSlot === null) return [];
    const visible = (c: any) => !isRestricted('live', c.categoryId);
    if (!query.trim()) {
      return favorites.filter((f) => f.kind === 'live' && visible(f.data)).map((f) => f.data as Channel);
    }
    return searchList(live, query).filter(visible).slice(0, 60) as Channel[];
  }, [pickerSlot, query, live, favorites, isRestricted]);

  const closePicker = () => {
    setPickerSlot(null);
    setQuery('');
  };

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold gradient-text">Multi-View</h1>
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
          {([2, 4] as const).map((n) => (
            <button
              key={n}
              onClick={() => setLayout(n)}
              className={`px-4 py-1.5 ${layout === n ? 'bg-blue-500/40 text-white' : 'text-white/60 hover:bg-white/5'}`}
            >
              {n === 2 ? '2 screens' : '4 screens'}
            </button>
          ))}
        </div>
        <span className="text-sm text-white/50">Click a screen to hear it.</span>
        {maxConnections > 0 && filled > maxConnections && (
          <span className="text-sm text-amber-300">
            ⚠ Your account allows {maxConnections} connection{maxConnections > 1 ? 's' : ''}; extra streams may fail.
          </span>
        )}
      </div>

      <div className={`flex-1 min-h-0 grid gap-3 ${layout === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {slots.slice(0, layout).map((id, index) => {
          const channel = id ? byId.get(id) : undefined;
          if (!channel) {
            return (
              <button
                key={index}
                onClick={() => setPickerSlot(index)}
                className="glass-panel rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-blue-400/50 flex flex-col items-center justify-center gap-2"
              >
                <span className="text-4xl">＋</span>
                <span className="text-sm">{id && !loaded ? 'Loading…' : 'Add channel'}</span>
              </button>
            );
          }
          if (isRestricted('live', (channel as any).categoryId)) {
            return (
              <div key={index} className="glass-panel rounded-lg border border-white/10 flex flex-col items-center justify-center gap-2 text-white/70">
                <span className="text-4xl">🔒</span>
                <span className="text-sm">{channel.name} is locked</span>
                <button onClick={() => requestUnlock()} className="glass-button px-4 py-1.5 text-sm">
                  Enter PIN
                </button>
              </div>
            );
          }
          return (
            <MultiViewTile
              key={`${index}-${channel.id}`}
              channel={channel}
              active={activeSlot === index}
              onFocus={() => setActiveSlot(index)}
              onRemove={() => setSlot(index, null)}
              onExpand={() => onExpand(channel)}
            />
          );
        })}
      </div>

      {pickerSlot !== null && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={closePicker}>
          <div
            className="glass-panel w-full max-w-lg max-h-[80vh] flex flex-col p-4 rounded-xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closePicker()}
              placeholder="Search channels (empty shows favorites)…"
              className="w-full glass-card px-4 py-2 mb-3 rounded-lg text-sm border border-white/10 outline-none focus:border-blue-400/50"
            />
            <div className="overflow-y-auto space-y-1">
              {pickerResults.length === 0 && (
                <div className="text-center text-white/50 py-6 text-sm">
                  {query.trim() ? 'No channels found' : 'No favorite channels yet. Type to search.'}
                </div>
              )}
              {pickerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSlot(pickerSlot, String(c.id));
                    setActiveSlot((a) => (filled === 0 ? pickerSlot : a));
                    closePicker();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-3"
                >
                  {c.logo ? <img src={c.logo} alt="" className="w-8 h-8 object-contain" /> : <span className="w-8 text-center">📺</span>}
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
