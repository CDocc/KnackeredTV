import React, { useEffect, useRef } from 'react';
import type { Channel, EPGEntry } from '../types';

const PX_PER_MIN = 5;
const HOURS = 4;
const NAME_COL = 180;
const SLOT_MS = 30 * 60 * 1000;

interface EpgGuideProps {
  channels: Channel[];
  epg: Record<string, EPGEntry[]>;
  now: number;
  playingId?: string;
  onPlay: (channel: Channel) => void;
  onScrollNearEnd: () => void;
  onCatchUp?: (channel: Channel) => void;
  // Clicking a programme that hasn't started yet offers to record it
  onSchedule?: (channel: Channel, entry: EPGEntry) => void;
  isScheduled?: (channel: Channel, entry: EPGEntry) => boolean;
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const EpgGuide = ({ channels, epg, now, playingId, onPlay, onScrollNearEnd, onCatchUp, onSchedule, isScheduled }: EpgGuideProps) => {
  const windowStart = Math.floor(now / SLOT_MS) * SLOT_MS - SLOT_MS;
  const windowEnd = windowStart + HOURS * 60 * 60 * 1000;
  const width = HOURS * 60 * PX_PER_MIN;
  const px = (ms: number) => ((ms - windowStart) / 60000) * PX_PER_MIN;
  const scroller = useRef<HTMLDivElement>(null);

  // Start with "now" near the left edge
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, px(now) - 120);
  }, []);

  const slots: number[] = [];
  for (let t = windowStart; t < windowEnd; t += SLOT_MS) slots.push(t);

  return (
    <div
      ref={scroller}
      className="flex-1 glass-panel rounded-xl overflow-auto border border-white/10"
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) onScrollNearEnd();
      }}
    >
      <div style={{ width: NAME_COL + width }} className="relative">
        {/* Time header */}
        <div className="flex sticky top-0 z-20 bg-[#0b1220] border-b border-white/10 h-8">
          <div style={{ width: NAME_COL }} className="sticky left-0 z-30 bg-[#0b1220] shrink-0" />
          <div className="relative" style={{ width }}>
            {slots.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full text-xs text-white/60 pl-2 border-l border-white/10 flex items-center"
                style={{ left: px(t) }}
              >
                {time(t)}
              </div>
            ))}
          </div>
        </div>

        {/* Now line */}
        <div
          className="absolute top-8 bottom-0 w-px bg-red-400/80 z-10 pointer-events-none"
          style={{ left: NAME_COL + px(now) }}
        />

        {channels.map((channel) => {
          const entries = (epg[String(channel.id)] || []).filter((e) => e.end > windowStart && e.start < windowEnd);
          return (
            <div key={channel.id} className="flex h-14 border-b border-white/5">
              <button
                onClick={() => onPlay(channel)}
                style={{ width: NAME_COL }}
                className={`sticky left-0 z-10 shrink-0 flex items-center gap-2 px-2 text-left text-sm truncate bg-[#0b1220] hover:bg-[#16203a] ${
                  playingId === String(channel.id) ? 'text-blue-300' : 'text-white'
                }`}
                title={`Play ${channel.name}`}
              >
                {channel.logo ? (
                  <img src={channel.logo} alt="" loading="lazy" className="w-8 h-8 object-contain shrink-0" />
                ) : (
                  <span className="w-8 text-center shrink-0 text-white/30">📺</span>
                )}
                <span className="truncate flex-1">{channel.name}</span>
                {channel.archive && onCatchUp && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCatchUp(channel);
                    }}
                    className="text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-blue-500/50 shrink-0"
                    title="Catch-up TV"
                  >
                    ⏪
                  </span>
                )}
              </button>
              <div className="relative" style={{ width }}>
                {entries.length === 0 && (
                  <div className="absolute inset-y-1 left-2 flex items-center text-xs text-white/30">No guide data</div>
                )}
                {entries.map((e) => {
                  const left = Math.max(0, px(e.start));
                  const right = Math.min(width, px(e.end));
                  const live = e.start <= now && e.end > now;
                  const future = e.start > now;
                  const scheduled = !!isScheduled?.(channel, e);
                  return (
                    <button
                      key={`${e.start}-${e.title}`}
                      onClick={() => (future && onSchedule ? onSchedule(channel, e) : onPlay(channel))}
                      className={`absolute inset-y-1 px-2 text-left text-xs rounded overflow-hidden border truncate ${
                        scheduled
                          ? 'bg-red-500/20 border-red-400/60 text-white'
                          : live
                          ? 'bg-blue-500/30 border-blue-400/60 text-white'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                      style={{ left: left + 1, width: Math.max(0, right - left - 2) }}
                      title={`${e.title}\n${time(e.start)} - ${time(e.end)}${e.description ? `\n\n${e.description}` : ''}${
                        future && onSchedule ? '\n\nClick to schedule a recording' : ''
                      }`}
                    >
                      <div className="truncate font-medium">
                        {scheduled && '⏺ '}
                        {e.title}
                      </div>
                      <div className="truncate text-white/40">
                        {time(e.start)} - {time(e.end)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
