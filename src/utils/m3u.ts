const axios = require('axios' /* webpackIgnore: true */);
const fs = require('fs' /* webpackIgnore: true */);
import type { Channel } from '../types';
import { M3U_USER } from './profileKind';

export { M3U_USER };
export const isM3uProfile = (username: string) => username === M3U_USER;

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; channels: Channel[] }>();

const hash = (value: string) => {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const attr = (line: string, name: string) => {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
};

export const parseM3u = (text: string): Channel[] => {
  const channels: Channel[] = [];
  const seen = new Set<string>();
  let pending: { name: string; logo: string; group: string; tvgId: string } | null = null;
  let num = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',', line.lastIndexOf('"') + 1);
      const title = comma >= 0 ? line.slice(comma + 1).trim() : '';
      pending = {
        name: title || attr(line, 'tvg-name') || 'Unnamed channel',
        logo: attr(line, 'tvg-logo'),
        group: attr(line, 'group-title').split(';')[0].trim() || 'Uncategorized',
        tvgId: attr(line, 'tvg-id'),
      };
    } else if (line.startsWith('#EXTGRP:') && pending) {
      if (pending.group === 'Uncategorized') pending.group = line.slice(8).trim() || pending.group;
    } else if (!line.startsWith('#') && pending) {
      const id = hash(line);
      if (!seen.has(id)) {
        seen.add(id);
        channels.push({
          id,
          name: pending.name,
          logo: pending.logo || undefined,
          num: ++num,
          archive: false,
          categoryId: pending.group,
          categoryName: pending.group,
          streamUrl: line,
        } as Channel);
      }
      pending = null;
    }
  }
  return channels;
};

export const loadPlaylist = async (location: string): Promise<Channel[]> => {
  const target = String(location || '').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').trim();
  if (!target) throw new Error('No playlist address provided');
  const cached = cache.get(target);
  if (cached && Date.now() - cached.at < TTL) return cached.channels;

  let text: string;
  if (/^https?:\/\//i.test(target)) {
    const response = await axios.get(target, {
      timeout: 60000,
      responseType: 'text',
      transformResponse: (data: any) => data,
      headers: { 'User-Agent': 'KnackeredTV' },
      maxContentLength: 200 * 1024 * 1024,
    });
    text = String(response.data);
  } else {
    text = fs.readFileSync(target, 'utf8');
  }

  if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
    throw new Error('That address did not return an M3U playlist');
  }
  const channels = parseM3u(text);
  if (channels.length === 0) throw new Error('The playlist contains no channels');
  cache.set(target, { at: Date.now(), channels });
  return channels;
};

export const clearPlaylistCache = () => cache.clear();

export const playlistCategories = (channels: Channel[]) => {
  const names = Array.from(new Set(channels.map((c) => c.categoryName)));
  names.sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({ category_id: name, category_name: name }));
};
