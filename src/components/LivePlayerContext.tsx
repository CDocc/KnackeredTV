import { createContext, useContext } from 'react';
import { Channel } from '../types';

// preview: docked beside the channel list on Live TV; mini: floating corner player on other pages
export type LivePlayerMode = 'full' | 'mini' | 'preview';

export interface LiveSession {
  channel: Channel;
  mode: LivePlayerMode;
}

export interface MediaSession {
  url: string;
  title: string;
  // Recordings and catch-up streams always go through the local ffmpeg server (seeking, AC3 audio, tracks)
  knownDuration?: number;
}

export interface LivePlayerApi {
  live: LiveSession | null;
  media: MediaSession | null;
  playMedia: (media: MediaSession) => void;
  stopMedia: () => void;
  // Without an explicit mode, a channel picked while the mini player is up stays in the mini player
  playChannel: (channel: Channel, mode?: LivePlayerMode) => void;
  minimize: () => void;
  expand: () => void;
  stop: () => void;
  // Channel zapping: the list is whatever category the user last browsed
  setZapList: (channels: Channel[]) => void;
  zap: (direction: 1 | -1) => void;
  zapToNumber: (num: number) => boolean;
  lastChannel: () => void;
}

const noop = () => {};

export const LivePlayerContext = createContext<LivePlayerApi>({
  live: null,
  media: null,
  playMedia: noop,
  stopMedia: noop,
  playChannel: noop,
  minimize: noop,
  expand: noop,
  stop: noop,
  setZapList: noop,
  zap: noop,
  zapToNumber: () => false,
  lastChannel: noop,
});

export const useLivePlayer = () => useContext(LivePlayerContext);
