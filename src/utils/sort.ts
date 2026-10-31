export type SortKey = 'default' | 'az' | 'za' | 'rating' | 'newest';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Provider order' },
  { key: 'az', label: 'A → Z' },
  { key: 'za', label: 'Z → A' },
  { key: 'rating', label: 'Top rated' },
  { key: 'newest', label: 'Recently added' },
];

interface Sortable {
  name: string;
  rating?: number;
  added?: number;
}

export const sortItems = <T extends Sortable>(items: T[], key: SortKey): T[] => {
  if (key === 'default') return items;
  const byName = (a: T, b: T) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  const sorted = [...items];
  if (key === 'az') return sorted.sort(byName);
  if (key === 'za') return sorted.sort((a, b) => byName(b, a));
  if (key === 'rating') return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b));
  return sorted.sort((a, b) => (b.added || 0) - (a.added || 0) || byName(a, b));
};

const sortStorageKey = (page: string) => `knackeredtv.sort.${page}`;

export const loadSort = (page: string): SortKey => {
  const saved = localStorage.getItem(sortStorageKey(page));
  return SORT_OPTIONS.some((o) => o.key === saved) ? (saved as SortKey) : 'default';
};

export const saveSort = (page: string, key: SortKey) => localStorage.setItem(sortStorageKey(page), key);
