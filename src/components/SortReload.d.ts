import React from 'react';
import { SortKey } from '../utils/sort';
interface SortReloadProps {
    sort: SortKey;
    onSort: (key: SortKey) => void;
    onReload: () => void;
    loading: boolean;
}
export declare const SortReload: ({ sort, onSort, onReload, loading }: SortReloadProps) => React.JSX.Element;
export {};
//# sourceMappingURL=SortReload.d.ts.map