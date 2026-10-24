import { useEffect, useRef, useState } from 'react';
import type { Channel, EPGEntry } from '../types';

const CHUNK = 24;
const REFRESH_MS = 5 * 60 * 1000;

// Loads guide data for the given channels (only the ones not fetched yet) and keeps a "now" clock ticking.
export function useEpg(profile: any, channels: Channel[]) {
  const [epg, setEpg] = useState<Record<string, EPGEntry[]>>({});
  const [now, setNow] = useState(Date.now());
  const requested = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    requested.current = new Map();
    setEpg({});
  }, [profile?.id, profile?.serverUrl, profile?.username]);

  const idsKey = channels.map((c) => c.id).join(',');
  useEffect(() => {
    const stamp = Date.now();
    const missing = channels
      .map((c) => String(c.id))
      .filter((id) => stamp - (requested.current.get(id) || 0) > REFRESH_MS);
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.set(id, stamp));

    let cancelled = false;
    (async () => {
      for (let i = 0; i < missing.length; i += CHUNK) {
        if (cancelled) {
          // Let a later render fetch whatever was not reached
          missing.slice(i).forEach((id) => requested.current.delete(id));
          return;
        }
        const result = await window.electron.ipcRenderer.invoke('get-epg', {
          serverUrl: profile.serverUrl,
          username: profile.username,
          password: profile.password,
          streamIds: missing.slice(i, i + CHUNK),
        });
        if (result?.success) setEpg((prev) => ({ ...prev, ...result.data }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, now > 0 && Math.floor(now / REFRESH_MS)]);

  return { epg, now };
}

export function currentProgram(entries: EPGEntry[] | undefined, now: number) {
  return entries?.find((e) => e.start <= now && e.end > now);
}

export function nextProgram(entries: EPGEntry[] | undefined, now: number) {
  return entries?.find((e) => e.start > now);
}
