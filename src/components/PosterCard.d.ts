import React from 'react';
interface PosterCardProps {
    title: string;
    image?: string;
    subtitle?: string;
    rating?: number;
    progress?: number;
    favorite?: boolean;
    onToggleFavorite?: () => void;
    onClick: () => void;
}
export declare const PosterCard: ({ title, image, subtitle, rating, progress, favorite, onToggleFavorite, onClick }: PosterCardProps) => React.JSX.Element;
export {};
//# sourceMappingURL=PosterCard.d.ts.map