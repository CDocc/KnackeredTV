declare class DatabaseManager {
    private db;
    private dbPath;
    constructor();
    initialize(): Promise<void>;
    private createTables;
    saveProfile(profile: any): Promise<void>;
    getProfiles(): Promise<any[]>;
    getProfile(id: string): Promise<any>;
    deleteProfile(id: string): Promise<void>;
    updateLastUsed(profileId: string): Promise<void>;
    savePlaybackPosition(type: string, contentId: string, position: number, duration: number, watched: boolean, meta?: any): Promise<void>;
    getPlaybackPosition(type: string, contentId: string): Promise<any>;
    getPlaybackHistory(type: string): Promise<any[]>;
    getContinueWatching(limit?: number): Promise<any[]>;
    getFavorites(profileId: string): Promise<any[]>;
    toggleFavorite(profileId: string, kind: string, itemId: string, data: any): Promise<boolean>;
    cacheSearch(profileId: string, type: string, title: string, data: any): Promise<void>;
    searchCache(profileId: string, query: string): Promise<any[]>;
    close(): void;
}
export declare const db: DatabaseManager;
export {};
//# sourceMappingURL=index.d.ts.map