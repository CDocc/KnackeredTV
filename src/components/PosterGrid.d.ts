import React from 'react';
interface PosterGridProps<T> {
    items: T[];
    getKey: (item: T) => string;
    render: (item: T) => React.ReactNode;
}
export declare function PosterGrid<T>({ items, getKey, render }: PosterGridProps<T>): React.JSX.Element;
export {};
//# sourceMappingURL=PosterGrid.d.ts.map