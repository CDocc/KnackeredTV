/// <reference types="react" />
export type FavoriteKind = 'live' | 'movie' | 'series';
export interface FavoriteRow {
    kind: FavoriteKind;
    itemId: string;
    data: any;
    addedAt: number;
}
export interface FavoritesApi {
    favorites: FavoriteRow[];
    isFavorite: (kind: FavoriteKind, id: string) => boolean;
    toggle: (kind: FavoriteKind, id: string, data: any) => void;
}
export declare const FavoritesContext: import("react").Context<FavoritesApi>;
export declare const useFavorites: () => FavoritesApi;
//# sourceMappingURL=FavoritesContext.d.ts.map