export const RELEASES_API = 'https://api.github.com/repos/CDocc/KnackeredTV/releases?per_page=20';
export const RELEASES_PAGE = 'https://github.com/CDocc/KnackeredTV/releases';

export interface ReleaseInfo {
  version: string;
  tag: string;
  name: string;
  notes: string;
  url: string;
  date: string;
}

export interface UpdateCheck {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  /** Releases newer than the running version, newest first */
  newer: ReleaseInfo[];
  /** Notes for the running version, when it has a published release */
  currentRelease: ReleaseInfo | null;
  error?: string;
}

const NOTES_END = ['<!-- downloads -->', '## Which file do I download?'];

/** Parses "v1.2.3" or "1.2.3-beta.1" into numbers and a pre-release tag; null when it is not a version. */
function parse(version: string): { nums: number[]; pre: string } | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(version).trim());
  if (!match) return null;
  return { nums: [1, 2, 3].map((i) => Number(match[i] || 0)), pre: match[4] || '' };
}

/** Negative when a < b, positive when a > b, 0 when equal; null when either side is not a version. */
export function compareVersions(a: string, b: string): number | null {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left.nums[i] !== right.nums[i]) return left.nums[i] < right.nums[i] ? -1 : 1;
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  return left.pre < right.pre ? -1 : 1;
}

/** Keeps the changelog part of a release body and drops the download instructions. */
export function releaseNotes(body: string | null | undefined): string {
  let text = String(body || '').replace(/\r\n/g, '\n');
  for (const marker of NOTES_END) {
    const at = text.indexOf(marker);
    if (at >= 0) text = text.slice(0, at);
  }
  return text.trim();
}

export function parseReleases(json: any): ReleaseInfo[] {
  if (!Array.isArray(json)) return [];
  const releases: ReleaseInfo[] = [];
  for (const item of json) {
    if (!item || item.draft || item.prerelease || typeof item.tag_name !== 'string') continue;
    if (!parse(item.tag_name)) continue;
    releases.push({
      version: item.tag_name.replace(/^v/, ''),
      tag: item.tag_name,
      name: item.name || item.tag_name,
      notes: releaseNotes(item.body),
      url: typeof item.html_url === 'string' ? item.html_url : RELEASES_PAGE,
      date: item.published_at || '',
    });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version) || 0);
}

export function evaluate(current: string, releases: ReleaseInfo[]): UpdateCheck {
  const newer = releases.filter((r) => (compareVersions(r.version, current) ?? 0) > 0);
  const currentRelease = releases.find((r) => compareVersions(r.version, current) === 0) || null;
  return {
    current,
    latest: releases.length ? releases[0].version : null,
    updateAvailable: newer.length > 0,
    newer,
    currentRelease,
  };
}

export async function checkForUpdates(current: string): Promise<UpdateCheck> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'KnackeredTV' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GitHub answered with HTTP ${response.status}`);
    return evaluate(current, parseReleases(await response.json()));
  } catch (err: any) {
    return { current, latest: null, updateAvailable: false, newer: [], currentRelease: null, error: err?.message || 'Update check failed' };
  }
}
