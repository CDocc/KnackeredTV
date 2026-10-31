// M3U profiles reuse the Xtream credential plumbing: this username marks the profile
// and serverUrl carries the playlist location.
export const M3U_USER = '__m3u__';
export const isM3uProfile = (profile: { username?: string } | null | undefined) => profile?.username === M3U_USER;

export const PUBLIC_PLAYLISTS = [
  { label: 'All channels (worldwide)', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { label: 'Grouped by category', url: 'https://iptv-org.github.io/iptv/index.category.m3u' },
  { label: 'Grouped by country', url: 'https://iptv-org.github.io/iptv/index.country.m3u' },
  { label: 'Grouped by language', url: 'https://iptv-org.github.io/iptv/index.language.m3u' },
];
