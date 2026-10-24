import React from 'react';
import type { FavoriteKind } from './FavoritesContext';
interface CategoryListProps {
    kind: FavoriteKind;
    categories: any[];
    selected: string | null;
    onSelect: (id: string) => void;
}
export declare const CategoryList: ({ kind, categories, selected, onSelect }: CategoryListProps) => React.JSX.Element;
export {};
//# sourceMappingURL=CategoryList.d.ts.map