import type { AccountInfo, Channel, EPGEntry } from '../types';
export declare class XtreamAPIClient {
    private baseUrl;
    private username;
    private password;
    private authToken;
    constructor(serverUrl: string, username: string, password: string);
    private getAuthParams;
    authenticate(): Promise<AccountInfo>;
    getShortEpg(streamId: string | number, limit?: number): Promise<EPGEntry[]>;
    getFullEpg(streamId: string | number): Promise<EPGEntry[]>;
    getCatchupUrl(streamId: string | number, start: number, end: number): Promise<string>;
    getLiveCategories(): Promise<any[]>;
    getLiveChannels(categoryId?: string): Promise<Channel[]>;
    getMovieCategories(): Promise<any[]>;
    getMovies(categoryId?: string): Promise<any[]>;
    getMovieInfo(vodId: string): Promise<any>;
    getSeriesCategories(): Promise<any[]>;
    getSeries(categoryId?: string): Promise<any[]>;
    getSeriesInfo(seriesId: string): Promise<any>;
    getStreamUrl(type: 'live' | 'movie' | 'series', streamId: string, extension?: string): string;
}
//# sourceMappingURL=xtreamApi.d.ts.map