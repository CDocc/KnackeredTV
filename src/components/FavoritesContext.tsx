import { createContext, useContext } from 'react';

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

export const FavoritesContext = createContext<FavoritesApi>({
  favorites: [],
  isFavorite: () => false,
  toggle: () => {},
});

export const useFavorites = () => useContext(FavoritesContext);
