/// <reference types="react" />
import type { FavoriteKind } from './FavoritesContext';
export interface ParentalApi {
    hasPin: boolean;
    unlocked: boolean;
    locked: Record<FavoriteKind, string[]>;
    isRestricted: (kind: FavoriteKind, categoryId: unknown) => boolean;
    isCategoryLocked: (kind: FavoriteKind, categoryId: unknown) => boolean;
    requestUnlock: () => Promise<boolean>;
    lockNow: () => void;
    toggleCategoryLock: (kind: FavoriteKind, categoryId: unknown) => Promise<void>;
    lockCategories: (kind: FavoriteKind, categoryIds: string[]) => Promise<void>;
    setPin: (pin: string, currentPin?: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    removePin: (pin: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
}
export declare const ParentalContext: import("react").Context<ParentalApi>;
export declare const useParental: () => ParentalApi;
//# sourceMappingURL=ParentalContext.d.ts.map