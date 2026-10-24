import React from 'react';
import type { Channel, EPGEntry } from '../types';
interface EpgGuideProps {
    channels: Channel[];
    epg: Record<string, EPGEntry[]>;
    now: number;
    playingId?: string;
    onPlay: (channel: Channel) => void;
    onScrollNearEnd: () => void;
    onCatchUp?: (channel: Channel) => void;
    onSchedule?: (channel: Channel, entry: EPGEntry) => void;
    isScheduled?: (channel: Channel, entry: EPGEntry) => boolean;
}
export declare const EpgGuide: ({ channels, epg, now, playingId, onPlay, onScrollNearEnd, onCatchUp, onSchedule, isScheduled }: EpgGuideProps) => React.JSX.Element;
export {};
//# sourceMappingURL=EpgGuide.d.ts.map