export interface VodProfile {
  id: string;
  serverUrl: string;
  username: string;
  password: string;
}

// URLs are built in the renderer on demand so credentials are never written to the history table
export const vodUrl = (
  profile: VodProfile,
  kind: 'movie' | 'series',
  id: string,
  ext: string
): string => {
  const base = profile.serverUrl.replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '').replace(/\/+$/, '');
  return `${base}/${kind}/${profile.username}/${profile.password}/${id}.${ext || 'mp4'}`;
};

export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
};

export interface HistoryRow {
  type: string;
  contentId: string;
  position: number;
  duration: number;
  watched: number;
  lastPlayedAt: number;
  meta: any;
}

export const loadHistory = async (type: 'movie' | 'episode', profileId: string): Promise<HistoryRow[]> => {
  const result = await window.electron.ipcRenderer.invoke('get-playback-history', { type });
  if (!result.success) return [];
  return (result.data as HistoryRow[]).filter((row) => row.meta?.profileId === profileId);
};

export const isResumable = (row?: HistoryRow | null): boolean =>
  !!row && !row.watched && row.position > 10 && row.duration > 0;
