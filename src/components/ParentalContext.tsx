import { createContext, useContext } from 'react';
import type { FavoriteKind } from './FavoritesContext';

export interface ParentalApi {
  hasPin: boolean;
  unlocked: boolean;
  locked: Record<FavoriteKind, string[]>;
  // True while the category is locked and the PIN has not been entered this session
  isRestricted: (kind: FavoriteKind, categoryId: unknown) => boolean;
  isCategoryLocked: (kind: FavoriteKind, categoryId: unknown) => boolean;
  // Resolves true when the PIN is not needed or was entered correctly
  requestUnlock: () => Promise<boolean>;
  lockNow: () => void;
  toggleCategoryLock: (kind: FavoriteKind, categoryId: unknown) => Promise<void>;
  lockCategories: (kind: FavoriteKind, categoryIds: string[]) => Promise<void>;
  setPin: (pin: string, currentPin?: string) => Promise<{ success: boolean; error?: string }>;
  removePin: (pin: string) => Promise<{ success: boolean; error?: string }>;
}

export const ParentalContext = createContext<ParentalApi>({
  hasPin: false,
  unlocked: true,
  locked: { live: [], movie: [], series: [] },
  isRestricted: () => false,
  isCategoryLocked: () => false,
  requestUnlock: async () => true,
  lockNow: () => {},
  toggleCategoryLock: async () => {},
  lockCategories: async () => {},
  setPin: async () => ({ success: false }),
  removePin: async () => ({ success: false }),
});

export const useParental = () => useContext(ParentalContext);
