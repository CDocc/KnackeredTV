import type { Channel } from '../types';
import { M3U_USER } from './profileKind';
export { M3U_USER };
export declare const isM3uProfile: (username: string) => boolean;
export declare const parseM3u: (text: string) => Channel[];
export declare const loadPlaylist: (location: string) => Promise<Channel[]>;
export declare const clearPlaylistCache: () => void;
export declare const playlistCategories: (channels: Channel[]) => {
    category_id: string;
    category_name: string;
}[];
//# sourceMappingURL=m3u.d.ts.map