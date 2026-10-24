import type { Channel, EPGEntry } from '../types';
export declare function useEpg(profile: any, channels: Channel[]): {
    epg: Record<string, EPGEntry[]>;
    now: number;
};
export declare function currentProgram(entries: EPGEntry[] | undefined, now: number): EPGEntry;
export declare function nextProgram(entries: EPGEntry[] | undefined, now: number): EPGEntry;
//# sourceMappingURL=useEpg.d.ts.map