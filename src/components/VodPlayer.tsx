import React, { useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { useLivePlayer } from './LivePlayerContext';

export interface VodProgressTarget {
  type: 'movie' | 'episode';
  contentId: string;
  meta: any;
}

interface VodPlayerProps {
  url: string;
  title: string;
  startTime?: number;
  progress: VodProgressTarget;
  onClose: () => void;
}

const SAVE_INTERVAL_MS = 5000;

// Wraps the player and persists the playback position so items can be resumed later
export const VodPlayer = ({ url, title, startTime = 0, progress, onClose }: VodPlayerProps) => {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const last = useRef({ position: 0, duration: 0 });
  const lastSavedAt = useRef(0);

  const save = () => {
    const { position, duration } = last.current;
    if (!isFinite(duration) || duration <= 0 || position < 1) return;
    const { type, contentId, meta } = progressRef.current;
    window.electron.ipcRenderer.invoke('save-playback-position', {
      type,
      contentId,
      position,
      duration,
      watched: position / duration > 0.95,
      meta,
    });
    lastSavedAt.current = Date.now();
  };

  useEffect(() => save, []);

  // Most IPTV accounts allow one connection, so a movie/episode replaces any live mini player
  const { stop: stopLive } = useLivePlayer();
  useEffect(() => {
    stopLive();
  }, []);

  return (
    <div className="w-full h-full">
      <VideoPlayer
        streamUrl={url}
        title={title}
        startTime={startTime}
        onClose={onClose}
        onTimeUpdate={(position: number, duration: number) => {
          last.current = { position, duration };
          if (Date.now() - lastSavedAt.current >= SAVE_INTERVAL_MS) save();
        }}
      />
    </div>
  );
};
