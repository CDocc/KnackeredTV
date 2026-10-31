export type SortKey = 'default' | 'az' | 'za' | 'rating' | 'newest';
export declare const SORT_OPTIONS: {
    key: SortKey;
    label: string;
}[];
interface Sortable {
    name: string;
    rating?: number;
    added?: number;
}
export declare const sortItems: <T extends Sortable>(items: T[], key: SortKey) => T[];
export declare const loadSort: (page: string) => SortKey;
export declare const saveSort: (page: string, key: SortKey) => void;
export {};
//# sourceMappingURL=sort.d.ts.map