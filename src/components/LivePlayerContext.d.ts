/// <reference types="react" />
import { Channel } from '../types';
export type LivePlayerMode = 'full' | 'mini' | 'preview';
export interface LiveSession {
    channel: Channel;
    mode: LivePlayerMode;
}
export interface MediaSession {
    url: string;
    title: string;
    knownDuration?: number;
}
export interface LivePlayerApi {
    live: LiveSession | null;
    media: MediaSession | null;
    playMedia: (media: MediaSession) => void;
    stopMedia: () => void;
    playChannel: (channel: Channel, mode?: LivePlayerMode) => void;
    minimize: () => void;
    expand: () => void;
    stop: () => void;
    setZapList: (channels: Channel[]) => void;
    zap: (direction: 1 | -1) => void;
    zapToNumber: (num: number) => boolean;
    lastChannel: () => void;
}
export declare const LivePlayerContext: import("react").Context<LivePlayerApi>;
export declare const useLivePlayer: () => LivePlayerApi;
//# sourceMappingURL=LivePlayerContext.d.ts.map