import React, { useEffect, useMemo, useState } from 'react';
import type { Channel, EPGEntry } from '../types';
import { useLivePlayer } from './LivePlayerContext';

const invoke = (channel: string, data?: any) => window.electron.ipcRenderer.invoke(channel, data);
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });

interface CatchUpModalProps {
  channel: Channel;
  profile: any;
  onClose: () => void;
}

// Past programmes of a channel that keeps an archive; picking one plays it from the provider's timeshift
export const CatchUpModal = ({ channel, profile, onClose }: CatchUpModalProps) => {
  const { playMedia } = useLivePlayer();
  const [entries, setEntries] = useState<EPGEntry[] | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke('get-epg-full', {
      serverUrl: profile.serverUrl,
      username: profile.username,
      password: profile.password,
      streamId: channel.id,
    }).then((result: any) => {
      if (cancelled) return;
      if (result.success) setEntries(result.data);
      else setError(result.error || 'Could not load the guide');
    });
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  const days = useMemo(() => {
    const now = Date.now();
    const oldest = now - (channel.archiveDays || 7) * 86400000;
    const past = (entries || []).filter((e) => e.end < now && e.start > oldest).sort((a, b) => b.start - a.start);
    const groups: { label: string; items: EPGEntry[] }[] = [];
    for (const e of past) {
      const label = dayLabel(e.start);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(e);
      else groups.push({ label, items: [e] });
    }
    return groups;
  }, [entries, channel.archiveDays]);

  const play = async (entry: EPGEntry) => {
    setStarting(entry.start);
    setError('');
    const result = await invoke('get-catchup-url', {
      serverUrl: profile.serverUrl,
      username: profile.username,
      password: profile.password,
      streamId: channel.id,
      start: entry.start,
      end: entry.end,
    });
    setStarting(null);
    if (!result.success) {
      setError(result.error || 'Could not build the catch-up link');
      return;
    }
    playMedia({
      url: result.data,
      title: `${channel.name} — ${entry.title}`,
      knownDuration: (entry.end - entry.start) / 1000,
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center p-8" onClick={onClose}>
      <div
        className="glass-panel rounded-xl border border-white/10 w-full max-w-2xl max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">⏪ Catch-up · {channel.name}</h3>
            <p className="text-xs text-white/40">
              Last {channel.archiveDays || '?'} days. Programmes play from the provider's archive.
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl px-2">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-3 text-red-200 text-sm">{error}</div>}
          {entries === null && !error && <div className="text-white/60 text-sm">Loading guide…</div>}
          {entries !== null && days.length === 0 && (
            <div className="text-white/60 text-sm">No archived programmes found for this channel.</div>
          )}
          {days.map((day) => (
            <div key={day.label} className="mb-4">
              <div className="text-xs uppercase tracking-wide text-white/50 mb-1">{day.label}</div>
              {day.items.map((e) => (
                <button
                  key={e.start}
                  onClick={() => play(e)}
                  disabled={starting !== null}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10 flex gap-3 disabled:opacity-50"
                  title={e.description}
                >
                  <span className="text-white/50 text-sm w-24 shrink-0">
                    {clock(e.start)} – {clock(e.end)}
                  </span>
                  <span className="text-white text-sm truncate">{starting === e.start ? 'Starting…' : e.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
