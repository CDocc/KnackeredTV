const axios = require('axios' /* webpackIgnore: true */);
import type { AccountInfo, Channel, EPGEntry } from '../types';

export class XtreamAPIClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authToken: string | null = null;

  constructor(serverUrl: string, username: string, password: string) {
    const clean = (value: string) => String(value || '').replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '');
    serverUrl = clean(serverUrl);
    this.baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    this.username = clean(username);
    this.password = clean(password);
  }

  private getAuthParams(): string {
    return `?username=${this.username}&password=${this.password}`;
  }

  async authenticate(): Promise<AccountInfo> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}`
      );

      if (response.data.result === false) {
        throw new Error('Authentication failed');
      }

      this.authToken = response.data.user_info?.auth_token || null;

      return {
        username: response.data.user_info.username || this.username,
        password: this.password,
        auth_token: this.authToken || '',
        status: response.data.user_info.status || 'Offline',
        exp_date: response.data.user_info.exp_date || 0,
        max_connections: response.data.user_info.max_connections || 1,
        allowed_output_formats:
          response.data.user_info.allowed_output_formats || [],
      };
    } catch (error) {
      throw new Error(
        `Failed to authenticate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getShortEpg(streamId: string | number, limit = 12): Promise<EPGEntry[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`,
        { timeout: 15000 }
      );
      const decode = (value: any) => {
        if (!value) return '';
        try {
          return Buffer.from(String(value), 'base64').toString('utf8');
        } catch {
          return String(value);
        }
      };
      return (response.data?.epg_listings || [])
        .map((item: any) => ({
          title: decode(item.title),
          description: decode(item.description),
          start: (Number(item.start_timestamp) || 0) * 1000,
          end: (Number(item.stop_timestamp) || 0) * 1000,
        }))
        .filter((item: EPGEntry) => item.title && item.end > item.start);
    } catch {
      return [];
    }
  }

  // Past + future guide for one channel (needed for catch-up; get_short_epg only returns what's coming up)
  async getFullEpg(streamId: string | number): Promise<EPGEntry[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_simple_data_table&stream_id=${streamId}`,
        { timeout: 20000 }
      );
      const decode = (value: any) => {
        if (!value) return '';
        try {
          return Buffer.from(String(value), 'base64').toString('utf8');
        } catch {
          return String(value);
        }
      };
      return (response.data?.epg_listings || [])
        .map((item: any) => ({
          title: decode(item.title),
          description: decode(item.description),
          start: (Number(item.start_timestamp) || 0) * 1000,
          end: (Number(item.stop_timestamp) || 0) * 1000,
          hasArchive: Number(item.has_archive) === 1,
        }))
        .filter((item: EPGEntry) => item.title && item.end > item.start);
    } catch {
      return [];
    }
  }

  // Xtream timeshift URLs take the start time in the provider's own timezone
  async getCatchupUrl(streamId: string | number, start: number, end: number): Promise<string> {
    let timeZone = 'UTC';
    try {
      const response = await axios.get(`${this.baseUrl}/player_api.php${this.getAuthParams()}`, { timeout: 15000 });
      timeZone = response.data?.server_info?.timezone || 'UTC';
    } catch {}
    let parts: Record<string, string> = {};
    const format = (tz: string) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(start))
        .reduce((acc: Record<string, string>, p) => ({ ...acc, [p.type]: p.value }), {});
    try {
      parts = format(timeZone);
    } catch {
      parts = format('UTC');
    }
    const stamp = `${parts.year}-${parts.month}-${parts.day}:${parts.hour}-${parts.minute}`;
    const minutes = Math.max(1, Math.ceil((end - start) / 60000));
    return `${this.baseUrl}/timeshift/${this.username}/${this.password}/${minutes}/${stamp}/${streamId}.ts`;
  }

  async getLiveCategories(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_live_categories`
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get live categories:', error);
      return [];
    }
  }

  async getLiveChannels(categoryId?: string): Promise<Channel[]> {
    try {
      const action = categoryId
        ? `get_live_streams&category_id=${categoryId}`
        : 'get_live_streams';

      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=${action}`
      );

      return (response.data || []).map((channel: any) => {
        // Standard Xtream Codes live endpoints: HLS first, raw MPEG-TS as fallback
        const streamFormats = [
          `${this.baseUrl}/live/${this.username}/${this.password}/${channel.stream_id}.m3u8`,
          `${this.baseUrl}/live/${this.username}/${this.password}/${channel.stream_id}.ts`,
        ];

        return {
          id: channel.stream_id,
          name: channel.name,
          logo: channel.stream_icon,
          num: Number(channel.num) || undefined,
          archive: Number(channel.tv_archive) === 1,
          archiveDays: Number(channel.tv_archive_duration) || 0,
          categoryId: channel.category_id,
          categoryName: channel.category_name || 'Uncategorized',
          // Primary format is .m3u8 (HLS - best HTML5 compatibility)
          streamUrl: streamFormats[0],
          // Alternative formats if primary fails (includes XC format as fallback)
          alternateUrls: streamFormats.slice(1),
        };
      });
    } catch (error) {
      console.error('Failed to get live channels:', error);
      return [];
    }
  }

  async getMovieCategories(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_vod_categories`
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get movie categories:', error);
      return [];
    }
  }

  async getMovies(categoryId?: string): Promise<any[]> {
    const action = categoryId
      ? `get_vod_streams&category_id=${categoryId}`
      : 'get_vod_streams';

    const response = await axios.get(
      `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=${action}`
    );

    const list = Array.isArray(response.data) ? response.data : [];
    return list.map((movie: any) => ({
      id: String(movie.stream_id),
      name: movie.name,
      poster: movie.stream_icon || '',
      rating: parseFloat(movie.rating) || 0,
      added: Number(movie.added) || 0,
      ext: movie.container_extension || 'mp4',
      categoryId: String(movie.category_id ?? ''),
    }));
  }

  async getMovieInfo(vodId: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_vod_info&vod_id=${vodId}`
    );
    const data = response.data || {};
    const info = data.info || {};
    const backdrop = Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path;
    return {
      plot: info.plot || info.description || '',
      cast: info.cast || info.actors || '',
      director: info.director || '',
      genre: info.genre || '',
      year: info.releasedate || info.release_date || '',
      duration: info.duration || '',
      durationSecs: Number(info.duration_secs) || 0,
      rating: parseFloat(info.rating) || 0,
      poster: info.movie_image || info.cover_big || '',
      backdrop: backdrop || '',
      ext: data.movie_data?.container_extension || 'mp4',
    };
  }

  async getSeriesCategories(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_series_categories`
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get series categories:', error);
      return [];
    }
  }

  async getSeries(categoryId?: string): Promise<any[]> {
    const action = categoryId
      ? `get_series&category_id=${categoryId}`
      : 'get_series';

    const response = await axios.get(
      `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=${action}`
    );

    const list = Array.isArray(response.data) ? response.data : [];
    return list.map((s: any) => ({
      id: String(s.series_id),
      name: s.name,
      poster: s.cover || '',
      plot: s.plot || '',
      genre: s.genre || '',
      year: s.releaseDate || s.release_date || '',
      rating: parseFloat(s.rating) || 0,
      backdrop: (Array.isArray(s.backdrop_path) ? s.backdrop_path[0] : s.backdrop_path) || '',
      added: Number(s.last_modified) || 0,
      categoryId: String(s.category_id ?? ''),
    }));
  }

  async getSeriesInfo(seriesId: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/player_api.php${this.getAuthParams()}&action=get_series_info&series_id=${seriesId}`
    );
    const data = response.data || {};

    // Some providers return `episodes` as an array instead of a season-keyed object
    const rawEpisodes: Record<string, any[]> = {};
    if (Array.isArray(data.episodes)) {
      for (const ep of data.episodes.flat()) {
        const season = String(ep.season ?? 1);
        (rawEpisodes[season] ||= []).push(ep);
      }
    } else {
      Object.assign(rawEpisodes, data.episodes || {});
    }

    const episodes: Record<number, any[]> = {};
    for (const [season, list] of Object.entries(rawEpisodes)) {
      episodes[Number(season)] = (list || [])
        .map((ep: any) => ({
          id: String(ep.id),
          season: Number(season),
          episode: Number(ep.episode_num) || 0,
          title: ep.title || `Episode ${ep.episode_num}`,
          ext: ep.container_extension || 'mp4',
          plot: ep.info?.plot || '',
          image: ep.info?.movie_image || '',
          duration: ep.info?.duration || '',
          durationSecs: Number(ep.info?.duration_secs) || 0,
        }))
        .sort((a: any, b: any) => a.episode - b.episode);
    }

    const info = data.info || {};
    return {
      info: {
        name: info.name || '',
        plot: info.plot || '',
        cast: info.cast || '',
        genre: info.genre || '',
        year: info.releaseDate || info.release_date || '',
        rating: parseFloat(info.rating) || 0,
        poster: info.cover || '',
        backdrop: (Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path) || '',
      },
      seasons: Object.keys(episodes).map(Number).sort((a, b) => a - b),
      episodes,
    };
  }

  getStreamUrl(type: 'live' | 'movie' | 'series', streamId: string, extension: string = 'ts'): string {
    const ext = type === 'movie' ? 'mp4' : extension;
    return `${this.baseUrl}/${type}/${this.username}/${this.password}/${streamId}.${ext}`;
  }
}
