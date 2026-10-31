export interface Library {
  live: any[];
  movie: any[];
  series: any[];
}

// Full catalogues are large, so they are fetched once per profile and reused (search, multi-view picker)
const cache = new Map<string, Library>();
const pending = new Map<string, Promise<Library>>();

export const getCachedLibrary = (profileId: string) => cache.get(profileId) ?? null;

// Used by the Reload buttons so search and multi-view also pick up changes on the server
export const clearLibrary = (profileId: string) => {
  cache.delete(profileId);
  pending.delete(profileId);
};

export const getLibrary = (profile: any): Promise<Library> => {
  const cached = cache.get(profile.id);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(profile.id);
  if (running) return running;

  const creds = { serverUrl: profile.serverUrl, username: profile.username, password: profile.password };
  const ipc = window.electron.ipcRenderer;
  const fetchAll = async (channel: string) => {
    const result = await ipc.invoke(channel, creds);
    return result.success && Array.isArray(result.data) ? result.data : [];
  };
  const promise = Promise.all([fetchAll('get-live-channels'), fetchAll('get-movies'), fetchAll('get-series')])
    .then(([live, movie, series]) => {
      const library = { live, movie, series };
      cache.set(profile.id, library);
      return library;
    })
    .finally(() => pending.delete(profile.id));
  pending.set(profile.id, promise);
  return promise;
};

// Every word must match; names that start with the query rank first
export const searchList = (items: any[], query: string): any[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const full = words.join(' ');
  const scored: { item: any; score: number }[] = [];
  for (const item of items) {
    const name = String(item.name || '').toLowerCase();
    if (!words.every((w) => name.includes(w))) continue;
    scored.push({ item, score: name.startsWith(full) ? 0 : name.includes(full) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
};
