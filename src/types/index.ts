export interface Profile {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  m3uUrl?: string;
  userAgent?: string;
  createdAt: number;
  lastUsed: number;
}

export interface AccountInfo {
  username: string;
  password: string;
  auth_token: string;
  status: string;
  exp_date: number;
  max_connections: number;
  allowed_output_formats: string[];
}

export interface Channel {
  id: string;
  name: string;
  logo?: string;
  num?: number;
  archive?: boolean;
  archiveDays?: number;
  categoryName: string;
  streamUrl: string;
  alternateUrls?: string[];
  epg?: EPGEntry;
}

export interface EPGEntry {
  title: string;
  start: number;
  end: number;
  description?: string;
  icon?: string;
  hasArchive?: boolean;
}

export interface Movie {
  id: string;
  name: string;
  description: string;
  poster_url?: string;
  backdrop_url?: string;
  duration: number;
  rating?: number;
  releaseDate?: string;
  streamUrl: string;
  alternateUrls?: string[];
  watched: boolean;
  watchedPosition: number;
}

export interface Series {
  id: string;
  name: string;
  description: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  cover?: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  seriesId: string;
  season: number;
  episode: number;
  name: string;
  description?: string;
  streamUrl: string;
  alternateUrls?: string[];
  watched: boolean;
  watchedPosition: number;
  duration: number;
}

export interface PlaybackState {
  channelId?: string;
  movieId?: string;
  episodeId?: string;
  position: number;
  duration: number;
  playing: boolean;
  error?: string;
}

export interface SearchResult {
  id: string;
  type: 'channel' | 'movie' | 'series' | 'episode';
  title: string;
  description?: string;
  image?: string;
  data: Channel | Movie | Series | Episode;
}
