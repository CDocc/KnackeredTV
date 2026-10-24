import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Channel, EPGEntry } from '../types';
import { useLivePlayer } from '../components/LivePlayerContext';
import { useFavorites } from '../components/FavoritesContext';
import { useParental } from '../components/ParentalContext';
import { CategoryList } from '../components/CategoryList';
import { EpgGuide } from '../components/EpgGuide';
import { CatchUpModal } from '../components/CatchUpModal';
import { useEpg, currentProgram, nextProgram } from '../utils/useEpg';

interface LiveTVProps {
  profile: any;
}

// Channels are rendered in pages as the grid is scrolled, so huge categories don't create thousands of DOM nodes
const PAGE_SIZE = 60;

export const LiveTV = ({ profile }: LiveTVProps) => {
  const { live, playChannel, setZapList } = useLivePlayer();
  const [categories, setCategories] = useState<any[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isFavorite, toggle } = useFavorites();
  const { isRestricted, requestUnlock } = useParental();
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [catchUpChannel, setCatchUpChannel] = useState<Channel | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleTarget, setScheduleTarget] = useState<{ channel: Channel; entry: EPGEntry } | null>(null);
  const [scheduleError, setScheduleError] = useState('');

  // Plain MPEG-TS is preferred for recording; HLS masters carry several variants
  const recordingSrc = (channel: Channel) => {
    const urls = [channel.streamUrl, ...(channel.alternateUrls || [])].filter(Boolean);
    return (urls.find((u) => /\.ts(\?|$)/i.test(u)) || urls[0] || '').replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '');
  };
  const refreshSchedules = useCallback(async () => {
    setSchedules((await window.electron.ipcRenderer.invoke('list-schedules')) || []);
  }, []);
  useEffect(() => {
    refreshSchedules();
  }, [refreshSchedules]);
  const findSchedule = (channel: Channel, entry: EPGEntry) =>
    schedules.find((s) => s.status === 'scheduled' && s.src === recordingSrc(channel) && s.start === entry.start);

  const confirmSchedule = async () => {
    if (!scheduleTarget) return;
    const { channel, entry } = scheduleTarget;
    const existing = findSchedule(channel, entry);
    const result = existing
      ? await window.electron.ipcRenderer.invoke('cancel-schedule', { id: existing.id })
      : await window.electron.ipcRenderer.invoke('schedule-recording', {
          src: recordingSrc(channel),
          name: `${channel.name} - ${entry.title}`,
          start: entry.start,
          end: entry.end,
        });
    if (!result?.success) {
      setScheduleError(result?.error || 'Could not schedule');
      return;
    }
    setScheduleTarget(null);
    setScheduleError('');
    refreshSchedules();
  };
  const [view, setView] = useState<'grid' | 'guide'>(
    () => (localStorage.getItem('liveView') === 'guide' ? 'guide' : 'grid')
  );
  const changeView = (next: 'grid' | 'guide') => {
    setView(next);
    localStorage.setItem('liveView', next);
  };
  useEffect(() => {
    loadCategories();
  }, []);

  const filteredChannels = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return channels.filter((ch) => ch.name.toLowerCase().includes(term));
  }, [channels, searchTerm]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [channels, searchTerm]);

  // Zapping walks the channels of the category being browsed
  useEffect(() => {
    if (channels.length > 0) setZapList(channels);
  }, [channels, setZapList]);

  const visibleChannels = useMemo(() => filteredChannels.slice(0, visibleCount), [filteredChannels, visibleCount]);
  const { epg, now } = useEpg(profile, visibleChannels);
  const showMore = () => setVisibleCount((count) => (count < filteredChannels.length ? count + PAGE_SIZE : count));

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) showMore();
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await window.electron.ipcRenderer.invoke(
        'get-live-categories',
        {
          serverUrl: profile.serverUrl,
          username: profile.username,
          password: profile.password,
        }
      );

      if (result.success) {
        setCategories(result.data || []);
        if (result.data && result.data.length > 0) {
          setSelectedCategory(result.data[0].category_id);
        }
      } else {
        setError(result.error || 'Failed to load categories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading categories');
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = useCallback(async (categoryId: string) => {
    try {
      setLoading(true);
      setError('');
      const result = await window.electron.ipcRenderer.invoke('get-live-channels', {
        serverUrl: profile.serverUrl,
        username: profile.username,
        password: profile.password,
        categoryId,
      });

      if (result.success) {
        setChannels(result.data || []);
        setSearchTerm('');
      } else {
        setError(result.error || 'Failed to load channels');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading channels');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const restricted = isRestricted('live', selectedCategory);

  useEffect(() => {
    if (!selectedCategory) return;
    if (restricted) {
      setChannels([]);
      setLoading(false);
      return;
    }
    loadChannels(selectedCategory);
  }, [selectedCategory, loadChannels, restricted]);

  return (
    <div className="flex h-full gap-4 p-4">
      <CategoryList kind="live" categories={categories} selected={selectedCategory == null ? null : String(selectedCategory)} onSelect={setSelectedCategory} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {restricted && (
          <div className="flex-1 glass-panel rounded-xl border border-white/10 flex flex-col items-center justify-center text-white/70">
            <div className="text-5xl mb-3">🔒</div>
            <p className="mb-4">This category is locked</p>
            <button onClick={() => requestUnlock()} className="glass-button px-5 py-2">
              Enter PIN
            </button>
          </div>
        )}
        {/* Search Bar */}
        {!restricted && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 glass-card px-4 py-3 rounded-lg text-sm border border-white/10 focus:border-blue-400/50 outline-none"
          />
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
            {(['grid', 'guide'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => changeView(mode)}
                className={`px-4 ${view === mode ? 'bg-blue-500/40 text-white' : 'text-white/60 hover:bg-white/5'}`}
              >
                {mode === 'grid' ? 'Grid' : 'Guide'}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Channels Grid */}
        {loading && !restricted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin-slow mb-4 text-4xl">⟳</div>
              <p className="text-white/60">Loading channels...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!loading && view === 'guide' && filteredChannels.length > 0 && (
          <EpgGuide
            channels={visibleChannels}
            epg={epg}
            now={now}
            playingId={live ? String(live.channel.id) : undefined}
            onPlay={(channel) => playChannel(channel)}
            onScrollNearEnd={showMore}
            onCatchUp={setCatchUpChannel}
            onSchedule={(channel, entry) => {
              setScheduleError('');
              setScheduleTarget({ channel, entry });
            }}
            isScheduled={(channel, entry) => !!findSchedule(channel, entry)}
          />
        )}

        {!loading && view === 'grid' && filteredChannels.length > 0 && (
          <div
            className="flex-1 glass-panel p-6 rounded-xl overflow-y-auto border border-white/10"
            onScroll={handleGridScroll}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {filteredChannels.slice(0, visibleCount).map((channel) => (
                <div
                  key={channel.id}
                  className={`group relative rounded-lg overflow-hidden bg-black/30 border transition-colors duration-300 ${
                    live?.channel.id === channel.id
                      ? 'border-blue-400 ring-2 ring-blue-400/60'
                      : 'border-white/10 hover:border-blue-400/50'
                  }`}
                >
                  {/* Channel Preview */}
                  <div
                    className="relative w-full aspect-video bg-black/50 cursor-pointer overflow-hidden"
                    onDoubleClick={() => playChannel(channel, 'full')}
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        loading="lazy"
                        decoding="async"
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

                    {/* Play overlay on hover */}
                    <button
                      onClick={() => playChannel(channel)}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                      title="Click to play (double-click for full screen)"
                    >
                      <svg
                        className="w-12 h-12 text-white drop-shadow-lg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>

                  {/* Channel Info */}
                  <div className="p-3 bg-gradient-to-t from-black/60 to-black/20">
                    <h4 className="font-semibold text-sm text-white truncate mb-1">
                      {channel.name}
                    </h4>
                    {(() => {
                      const entries = epg[String(channel.id)];
                      const current = currentProgram(entries, now);
                      const next = nextProgram(entries, now);
                      const pct = current ? ((now - current.start) / (current.end - current.start)) * 100 : 0;
                      return (
                        <>
                          <p className="text-xs text-white/70 truncate" title={current?.description || current?.title}>
                            {current?.title || (entries ? 'No guide data' : '…')}
                          </p>
                          {current && (
                            <div className="h-1 my-1 rounded bg-white/10 overflow-hidden">
                              <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          )}
                          {next && <p className="text-[11px] text-white/40 truncate">Next: {next.title}</p>}
                        </>
                      );
                    })()}
                  </div>

                  {/* Catch-up Button */}
                  {channel.archive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCatchUpChannel(channel);
                      }}
                      className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-black/60 hover:bg-blue-500/60 text-white drop-shadow-lg"
                      title={`Catch-up TV (last ${channel.archiveDays || '?'} days)`}
                    >
                      ⏪ Catch-up
                    </button>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle('live', channel.id, channel);
                    }}
                    className="absolute top-2 right-2 text-xl transition-transform hover:scale-125 drop-shadow-lg"
                    title={isFavorite('live', channel.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFavorite('live', channel.id) ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && filteredChannels.length === 0 && channels.length > 0 && (
          <div className="flex-1 flex items-center justify-center text-white/60">
            No channels match your search
          </div>
        )}

        {!loading && !restricted && channels.length === 0 && !error && (
          <div className="flex-1 flex items-center justify-center text-white/60">
            No channels available
          </div>
        )}
      </div>
      {scheduleTarget && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setScheduleTarget(null)}>
          <div className="glass-panel w-full max-w-sm p-6 rounded-xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-1">
              {findSchedule(scheduleTarget.channel, scheduleTarget.entry) ? 'Cancel scheduled recording?' : 'Schedule recording'}
            </h3>
            <p className="text-white/90 truncate">{scheduleTarget.entry.title}</p>
            <p className="text-sm text-white/60 mb-3">
              {scheduleTarget.channel.name} ·{' '}
              {new Date(scheduleTarget.entry.start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} -{' '}
              {new Date(scheduleTarget.entry.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-white/40 mb-3">
              Starts 1 minute early and ends 3 minutes late. KnackeredTV must be running, and your account needs a free connection.
            </p>
            {scheduleError && <p className="text-sm text-red-300 mb-2">{scheduleError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setScheduleTarget(null)} className="glass-button flex-1 py-2 text-sm">
                Close
              </button>
              <button onClick={confirmSchedule} className="flex-1 py-2 text-sm rounded-lg bg-red-500/50 hover:bg-red-500/70 text-white">
                {findSchedule(scheduleTarget.channel, scheduleTarget.entry) ? 'Cancel recording' : '⏺ Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
      {catchUpChannel && (
        <CatchUpModal channel={catchUpChannel} profile={profile} onClose={() => setCatchUpChannel(null)} />
      )}
    </div>
  );
};
