export interface VodProfile {
    id: string;
    serverUrl: string;
    username: string;
    password: string;
}
export declare const vodUrl: (profile: VodProfile, kind: 'movie' | 'series', id: string, ext: string) => string;
export declare const formatTime: (seconds: number) => string;
export interface HistoryRow {
    type: string;
    contentId: string;
    position: number;
    duration: number;
    watched: number;
    lastPlayedAt: number;
    meta: any;
}
export declare const loadHistory: (type: 'movie' | 'episode', profileId: string) => Promise<HistoryRow[]>;
export declare const isResumable: (row?: HistoryRow | null) => boolean;
//# sourceMappingURL=vod.d.ts.map