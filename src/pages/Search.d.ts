import React from 'react';
import { FavoriteKind } from '../components/FavoritesContext';
interface SearchProps {
    profile: any;
    query: string;
    onQueryChange: (q: string) => void;
    onOpen: (kind: FavoriteKind, item: any) => void;
}
export declare const Search: ({ profile, query, onQueryChange, onOpen }: SearchProps) => React.JSX.Element;
export {};
//# sourceMappingURL=Search.d.ts.map