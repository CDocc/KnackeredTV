import React, { useState } from 'react';

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

export const PosterCard = ({ title, image, subtitle, rating, progress, favorite, onToggleFavorite, onClick }: PosterCardProps) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;

  return (
    <div className="relative group/card">
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl overflow-hidden bg-black/30 border border-white/10
        hover:border-blue-400/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10
        transition-all duration-200 focus:outline-none focus:border-blue-400"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-blue-500/20 to-purple-500/20 overflow-hidden">
        {showImage ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/30">
            {title.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}

        {rating ? (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-yellow-300 text-xs font-semibold">
            ★ {rating.toFixed(1)}
          </div>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        {progress ? (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        ) : null}
      </div>

      <div className="p-2.5">
        <div className="text-sm font-medium text-white truncate" title={title}>{title}</div>
        {subtitle ? <div className="text-xs text-white/50 truncate mt-0.5">{subtitle}</div> : null}
      </div>
    </button>
    {onToggleFavorite && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-black/70 text-lg flex items-center justify-center
          transition-all hover:scale-110 ${favorite ? 'text-yellow-300' : 'text-white/70 opacity-0 group-hover/card:opacity-100'}`}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        {favorite ? '★' : '☆'}
      </button>
    )}
    </div>
  );
};
