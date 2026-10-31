// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

interface VideoPlayerProps {
  streamUrl: string;
  onClose: () => void;
  title?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  alternateUrls?: string[];
}

const VOLUME_KEY = 'knackeredtv.volume';
const MUTED_KEY = 'knackeredtv.muted';
const STALL_TIMEOUT_MS = 15000;
const STARTUP_TIMEOUT_MS = 20000;

const loadVolume = () => {
  const v = parseFloat(localStorage.getItem(VOLUME_KEY) || '');
  return isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
};

export const VideoPlayer = (props: any) => {
  const onClose = props.onClose;
  const title = props.title || '';
  const isLive: boolean = !!props.isLive;
  const mode: 'full' | 'mini' | 'preview' = props.mode || 'full';
  // The docked preview uses the same compact controls as the floating mini player
  const isMini = mode !== 'full';
  const onMinimize = props.onMinimize;
  const onExpand = props.onExpand;
  const onTimeUpdateRef = useRef(props.onTimeUpdate);
  onTimeUpdateRef.current = props.onTimeUpdate;
  const startTimeRef = useRef(props.startTime || 0);
  startTimeRef.current = props.startTime || 0;
  const resumedRef = useRef(false);

  // Stable key so the source effect only re-runs when the actual URLs change
  const urlKey = [props.streamUrl, ...(props.alternateUrls || [])].filter(Boolean).join('\n');
  const urlsToTry = useMemo(() => (urlKey ? urlKey.split('\n') : []), [urlKey]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string>('');
  const [showControls, setShowControls] = useState(true);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isLoadingMessage, setIsLoadingMessage] = useState('Loading stream...');
  const controlsTimeoutRef = useRef<any>();
  const [volume, setVolume] = useState(loadVolume);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTED_KEY) === '1');
  const [volumeToast, setVolumeToast] = useState(false);
  const toastTimeoutRef = useRef<any>();
  const lastShownSecondRef = useRef(-1);

  // Channel zapping (live only): a banner on every channel change and a typed-number buffer
  const [banner, setBanner] = useState(isLive && !isMini);
  const [digits, setDigits] = useState('');
  const [digitsMessage, setDigitsMessage] = useState('');
  const digitsRef = useRef('');
  const digitsTimerRef = useRef<any>();

  useEffect(() => {
    if (!isLive || isMini) return;
    setBanner(true);
    const t = setTimeout(() => setBanner(false), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => clearTimeout(digitsTimerRef.current), []);

  const commitDigits = () => {
    clearTimeout(digitsTimerRef.current);
    const num = parseInt(digitsRef.current, 10);
    digitsRef.current = '';
    if (!num || !props.onChannelNumber) return setDigits('');
    if (props.onChannelNumber(num)) return;
    setDigits('');
    setDigitsMessage(`No channel ${num}`);
    setTimeout(() => setDigitsMessage(''), 1500);
  };

  const typeDigit = (digit: string) => {
    digitsRef.current = (digitsRef.current + digit).slice(0, 4);
    setDigits(digitsRef.current);
    clearTimeout(digitsTimerRef.current);
    digitsTimerRef.current = setTimeout(commitDigits, 1500);
  };
  // Movies often carry AC3/DTS audio Chromium can't decode; those get re-served with AAC audio.
  // transcodeStart is the source position (seconds) the transcoded stream begins at.
  const [transcodeStart, setTranscodeStart] = useState<number | null>(null);
  const transcodeBaseRef = useRef('');
  const offsetRef = useRef(0);
  const fullDurationRef = useRef(0);
  const audioCheckedRef = useRef(false);
  const transcodeFailedRef = useRef(false);
  const [reencode, setReencode] = useState(false);
  offsetRef.current = transcodeStart ?? 0;

  // Audio/subtitle track selection (VOD only; needs the transcode path to switch tracks)
  const [audioIndex, setAudioIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(-1);
  const [tracks, setTracks] = useState<any>({ audio: [], subs: [] });
  const [trackMenuOpen, setTrackMenuOpen] = useState(false);
  const subTrackRef = useRef<any>(null);
  const lastSubsTextRef = useRef('');

  useEffect(() => {
    setAudioIndex(0);
    setSubIndex(-1);
    setTracks({ audio: [], subs: [] });
  }, [urlsToTry[0]]);

  const trackLabel = (t: any, kind: string, i: number) => {
    let lang = '';
    try {
      if (t.lang) lang = new (Intl as any).DisplayNames(['en'], { type: 'language' }).of(t.lang) || t.lang;
    } catch {
      lang = t.lang;
    }
    const parts = [lang || `${kind} ${i + 1}`];
    if (t.title && t.title !== lang) parts.push(t.title);
    parts.push(String(t.codec).toUpperCase() + (t.channels ? ` ${t.channels}` : ''));
    return parts.join(' · ');
  };

  const changeTrack = (kind: 'audio' | 'sub', index: number) => {
    const position = (videoRef.current?.currentTime || 0) + offsetRef.current;
    if (kind === 'audio') setAudioIndex(index);
    else setSubIndex(index);
    lastSubsTextRef.current = '';
    if (transcodeStart !== null) setTranscodeStart(Math.max(0, position));
    setTrackMenuOpen(false);
  };

  const toggleTrackMenu = () => {
    if (!trackMenuOpen && transcodeStart === null && !isLive) {
      startTranscode((videoRef.current?.currentTime || 0) + offsetRef.current);
    }
    setTrackMenuOpen((open) => !open);
  };

  // Track list and subtitle cues come from the local transcode server
  useEffect(() => {
    if (isLive || transcodeStart === null) return;
    let stopped = false;
    const parseTime = (s: string) => {
      const p = s.trim().replace(',', '.').split(':').map(parseFloat);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : NaN;
    };
    const poll = async () => {
      try {
        const info = await window.electron.ipcRenderer.invoke('get-transcode-tracks');
        if (!stopped && info) {
          setTracks((prev: any) =>
            prev.audio.length === info.audio.length && prev.subs.length === info.subs.length ? prev : info
          );
        }
        const video = videoRef.current;
        if (!video || stopped) return;
        if (subIndex < 0) {
          if (subTrackRef.current) {
            subTrackRef.current.mode = 'disabled';
            while (subTrackRef.current.cues?.length) subTrackRef.current.removeCue(subTrackRef.current.cues[0]);
          }
          return;
        }
        const base = transcodeBaseRef.current;
        const text = await (await fetch(`${base}subs`)).text();
        if (stopped || text === lastSubsTextRef.current) return;
        lastSubsTextRef.current = text;
        if (!subTrackRef.current) subTrackRef.current = video.addTextTrack('subtitles', 'Subtitles', 'en');
        const track = subTrackRef.current;
        while (track.cues?.length) track.removeCue(track.cues[0]);
        for (const block of text.split(/\r?\n\r?\n/)) {
          const lines = block.split(/\r?\n/);
          const at = lines.findIndex((l) => l.includes('-->'));
          if (at < 0) continue;
          const [from, to] = lines[at].split('-->');
          const body = lines
            .slice(at + 1)
            .join('\n')
            .replace(/<[^>]+>/g, '');
          const start = parseTime(from);
          const end = parseTime(to.trim().split(/\s+/)[0]);
          if (body.trim() && Number.isFinite(start) && Number.isFinite(end) && end > start) {
            track.addCue(new VTTCue(start, end, body));
          }
        }
        track.mode = 'showing';
        console.info('[subs] cues loaded:', track.cues?.length, 'first:', track.cues?.[0]?.startTime, 'video t:', video.currentTime);
      } catch (e) {
        console.warn('[subs] poll failed', String(e));
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isLive, transcodeStart, subIndex, audioIndex, urlsToTry[0]]);

  const startTranscode = async (at: number) => {
    if (!transcodeBaseRef.current) {
      transcodeBaseRef.current = await window.electron.ipcRenderer.invoke('get-transcode-base');
    }
    setTranscodeStart(Math.max(0, at));
  };

  // Recordings and catch-up: learn the duration, then go straight to the transcode server
  useEffect(() => {
    if (!props.forceTranscode || isLive || !urlsToTry[0]) return;
    let cancelled = false;
    setIsLoadingMessage('Preparing...');
    (async () => {
      const info = await window.electron.ipcRenderer.invoke('probe-media', { src: urlsToTry[0] });
      if (cancelled) return;
      const total = info?.duration || props.knownDuration || 0;
      fullDurationRef.current = total;
      setDuration(total);
      audioCheckedRef.current = true;
      startTranscode(startTimeRef.current > 5 ? startTimeRef.current : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [urlKey]);

  // Recording the live channel (live only): state comes from the main process so it survives zapping
  const [recording, setRecording] = useState<any>(null);
  useEffect(() => {
    if (!isLive) return;
    let stopped = false;
    const poll = async () => {
      const list = await window.electron.ipcRenderer.invoke('get-active-recordings');
      if (stopped) return;
      const mine = (list || []).find((r: any) => urlsToTry.some((u: string) => u.replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '') === r.src));
      setRecording(mine || null);
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isLive, urlKey]);

  const toggleRecording = async () => {
    if (recording) {
      await window.electron.ipcRenderer.invoke('stop-recording', { id: recording.id });
      setRecording(null);
      return;
    }
    // Plain MPEG-TS is preferred for recording; HLS masters carry several variants
    const src = urlsToTry.find((u: string) => /\.ts(\?|$)/i.test(u)) || urlsToTry[0];
    const result = await window.electron.ipcRenderer.invoke('start-recording', { src, name: title });
    if (result?.success) setRecording(result.data);
    else console.warn('[record] could not start:', result?.error);
  };

  const seekTo = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, fullDurationRef.current ? Math.min(t, fullDurationRef.current) : t);
    if (transcodeStart !== null) {
      setCurrentTime(target);
      startTranscode(target);
    } else {
      video.currentTime = target;
    }
  };

  // The element persists across channel/URL changes, so volume only needs to track state
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = muted;
    }
    localStorage.setItem(VOLUME_KEY, String(volume));
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  }, [volume, muted]);

  const flashVolume = () => {
    setVolumeToast(true);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setVolumeToast(false), 1200);
  };

  const changeVolume = (next: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(next * 100) / 100));
    setVolume(clamped);
    setMuted(clamped === 0);
  };

  const toggleMute = () => {
    if (muted && volume === 0) setVolume(0.5);
    setMuted(!muted);
  };

  useEffect(() => () => {
    clearTimeout(toastTimeoutRef.current);
    clearTimeout(controlsTimeoutRef.current);
  }, []);

  // Reset to the first URL whenever the channel/stream changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setError('');
    setIsLoadingMessage('Loading stream...');
    setTranscodeStart(null);
    audioCheckedRef.current = false;
    transcodeFailedRef.current = false;
    setReencode(false);
  }, [urlKey]);

  // Media element events (attached once, no source handling here)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkAudio = () => {
      if (isLive || audioCheckedRef.current || video.paused || video.currentTime < 2) return;
      const v: any = video;
      const decoded = v.webkitAudioDecodedByteCount;
      console.log('[audio-debug] check', {
        currentTime: video.currentTime,
        decodedBytes: decoded,
        audioTracks: v.audioTracks?.length,
        muted: video.muted,
        volume: video.volume,
        readyState: video.readyState,
      });
      audioCheckedRef.current = true;
      const noAudio = decoded === 0 || v.audioTracks?.length === 0;
      if (noAudio && isFinite(video.duration)) {
        const position = video.currentTime + offsetRef.current;
        console.warn('[player] no audio decoded, switching to transcoded audio');
        fullDurationRef.current = video.duration;
        setDuration(video.duration);
        setIsLoadingMessage('Preparing audio...');
        startTranscode(position);
      }
    };
    let audioTimer: any = null;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      const transcoded = offsetRef.current > 0 || fullDurationRef.current > 0;
      const position = video.currentTime + offsetRef.current;
      const total = transcoded ? fullDurationRef.current : video.duration;
      onTimeUpdateRef.current?.(position, total);
      checkAudio();

      // Live streams have no meaningful position; VOD only needs a re-render once per second
      if (isLive) return;
      const second = Math.floor(position);
      if (second === lastShownSecondRef.current) return;
      lastShownSecondRef.current = second;
      setCurrentTime(position);
      setDuration(total);
    };
    const onPlaying = () => {
      console.log('[audio-debug] playing', {
        transcoded: offsetRef.current > 0 || fullDurationRef.current > 0,
        decodedBytes: (video as any).webkitAudioDecodedByteCount,
        muted: video.muted,
        volume: video.volume,
      });
      setError('');
      setIsLoadingMessage('');
      // Independent of timeupdate: re-check shortly after playback starts
      clearInterval(audioTimer);
      audioTimer = setInterval(checkAudio, 1000);
    };
    const onWaiting = () => setIsLoadingMessage('Buffering...');
    const onLoadedMetadata = () => {
      // Containers like mkv/avi nearly always carry AC3/DTS audio Chromium can't play: convert right away
      if (
        !isLive &&
        !transcodeFailedRef.current &&
        offsetRef.current === 0 &&
        /\.(mkv|avi|wmv|flv|mov)(\?|$)/i.test(video.currentSrc) &&
        isFinite(video.duration)
      ) {
        console.log('[player] container needs audio conversion, switching to transcode');
        audioCheckedRef.current = true;
        fullDurationRef.current = video.duration;
        setDuration(video.duration);
        setIsLoadingMessage('Preparing audio...');
        startTranscode(startTimeRef.current > 5 ? startTimeRef.current : 0);
        return;
      }
      if (!resumedRef.current && startTimeRef.current > 5 && isFinite(video.duration)) {
        video.currentTime = Math.min(startTimeRef.current, Math.max(0, video.duration - 5));
      }
      resumedRef.current = true;
    };

    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);

    if (!isMini) containerRef.current?.focus();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      clearInterval(audioTimer);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  // Source loading: hls.js for .m3u8, mpegts.js for .ts, native for the rest.
  // Fatal errors retry the same URL a few times (auto-reconnect) before moving on.
  useEffect(() => {
    const video = videoRef.current;
    const baseUrl = urlsToTry[currentUrlIndex];
    const transcoding = transcodeStart !== null && !!transcodeBaseRef.current;
    const url = transcoding
      ? `${transcodeBaseRef.current}?src=${encodeURIComponent(baseUrl)}&start=${transcodeStart}&venc=${reencode ? 1 : 0}&audio=${audioIndex}&sub=${subIndex}`
      : baseUrl;
    if (!video || !url) return;
    // Recordings/catch-up wait for the transcode URL instead of loading the raw source
    if (props.forceTranscode && !transcoding) return;

    let disposed = false;
    resumedRef.current = transcoding;
    let retries = 0;
    let hls: any = null;
    let ts: any = null;
    const MAX_RETRIES = 3;

    const fail = (reason: string) => {
      if (disposed) return;
      console.error(`[player] ${reason} -> ${url}`);
      if (transcoding) {
        window.electron.ipcRenderer.invoke('get-transcode-log').then((log: string) =>
          console.warn('[player] ffmpeg said:', log || '(nothing)')
        );
        if (!reencode) {
          // Copying the video stream failed (likely an unsupported codec): retry re-encoding it
          console.warn('[player] transcode failed, retrying with video re-encode');
          setReencode(true);
          return;
        }
        console.warn('[player] transcode failed, falling back to direct playback');
        if (props.forceTranscode) {
          setError('Unable to play this. The stream or recording could not be opened.');
          return;
        }
        transcodeFailedRef.current = true;
        resumedRef.current = false;
        startTimeRef.current = transcodeStart;
        audioCheckedRef.current = true;
        fullDurationRef.current = 0;
        setReencode(false);
        setTranscodeStart(null);
        return;
      }
      if (currentUrlIndex < urlsToTry.length - 1) {
        setCurrentUrlIndex(currentUrlIndex + 1);
      } else {
        setIsLoadingMessage('');
        setError('Unable to play this stream. Check the server, your credentials, or connection limit.');
      }
    };

    const retryOrFail = (reason: string, retry: () => void) => {
      if (disposed) return;
      if (retries < MAX_RETRIES) {
        retries++;
        console.warn(`[player] ${reason}, reconnecting (${retries}/${MAX_RETRIES})`);
        setIsLoadingMessage(`Reconnecting (${retries}/${MAX_RETRIES})...`);
        setTimeout(() => {
          if (disposed) return;
          retry();
          armStartup();
        }, 1000 * retries);
      } else {
        fail(reason);
      }
    };

    // A connection that hangs without raising any event would otherwise load forever
    let startupTimer: any = null;
    const armStartup = () => {
      clearTimeout(startupTimer);
      if (props.forceTranscode || transcoding) return;
      startupTimer = setTimeout(() => {
        startupTimer = null;
        retryOrFail('no data received', () => reload());
      }, STARTUP_TIMEOUT_MS);
    };

    console.log(`[player] loading ${currentUrlIndex + 1}/${urlsToTry.length}: ${url}`);
    setIsLoadingMessage(`Loading stream (${currentUrlIndex + 1}/${urlsToTry.length})...`);

    const play = () => video.play().catch((e) => console.warn('[player] play() rejected:', e.message));

    // Reconnect on a long stall (live streams can hang silently without raising an error),
    // and give the retry budget back once playback has recovered.
    let stallTimer: any = null;
    let reload: () => void = () => {};
    const onStallWaiting = () => {
      if (!isLive || stallTimer) return;
      stallTimer = setTimeout(() => {
        stallTimer = null;
        retryOrFail('stream stalled', () => reload());
      }, STALL_TIMEOUT_MS);
    };
    const onStallPlaying = () => {
      clearTimeout(stallTimer);
      clearTimeout(startupTimer);
      stallTimer = null;
      retries = 0;
    };
    video.addEventListener('waiting', onStallWaiting);
    video.addEventListener('playing', onStallPlaying);

    if (/\.m3u8(\?|$)/i.test(url) && Hls.isSupported()) {
      // Bounded buffers keep memory flat on long live sessions
      hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });
      reload = () => hls.loadSource(url);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
        console.warn('[player] hls error:', data.type, data.details, data.response?.code || '');
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          retryOrFail(`HLS network error (${data.details})`, () => hls.startLoad());
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          retryOrFail(`HLS media error (${data.details})`, () => hls.recoverMediaError());
        } else {
          fail(`HLS fatal error (${data.details})`);
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (/\.ts(\?|$)/i.test(url) && mpegts.isSupported()) {
      const load = () => {
        ts?.destroy();
        ts = mpegts.createPlayer(
          { type: 'mpegts', isLive: true, url },
          {
            // Without cleanup the MSE buffer grows for the whole session and the player slows down
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 30,
            autoCleanupMinBackwardDuration: 15,
            // Gently speed up to the live edge instead of drifting further behind
            liveSync: true,
            liveSyncMaxLatency: 12,
            liveSyncTargetLatency: 6,
            lazyLoad: false,
          }
        );
        ts.on(mpegts.Events.ERROR, (type: string, detail: string) =>
          retryOrFail(`MPEG-TS error (${type}/${detail})`, load)
        );
        ts.attachMediaElement(video);
        ts.load();
        play();
      };
      reload = load;
      load();
    } else {
      const onNativeError = () => fail(`native playback error code ${video.error?.code}`);
      video.addEventListener('error', onNativeError, { once: true });
      reload = () => {
        video.load();
        play();
      };
      video.src = url;
      play();
    }
    armStartup();

    return () => {
      disposed = true;
      clearTimeout(stallTimer);
      clearTimeout(startupTimer);
      video.removeEventListener('waiting', onStallWaiting);
      video.removeEventListener('playing', onStallPlaying);
      hls?.destroy();
      ts?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [urlsToTry, currentUrlIndex, transcodeStart, reencode, audioIndex, subIndex]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current !== undefined) {
      clearTimeout(controlsTimeoutRef.current as any);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000) as any;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const togglePiP = async () => {
    try {
      if (!isPiP) {
        if (document.pictureInPictureEnabled && videoRef.current) {
          const video = videoRef.current as HTMLVideoElement & {
            requestPictureInPicture?: () => Promise<any>;
          };
          await video.requestPictureInPicture?.();
          setIsPiP(true);
        }
      } else {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPiP(false);
        }
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const seekBy = (delta: number) => {
    if (!isLive) seekTo((videoRef.current ? videoRef.current.currentTime + offsetRef.current : 0) + delta);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (isLive) {
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)?.[2];
      if (digit !== undefined) {
        e.preventDefault();
        typeDigit(digit);
        return;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (digitsRef.current) {
          e.preventDefault();
          commitDigits();
          return;
        }
      }
      if (e.code === 'PageUp' || e.code === 'PageDown') {
        e.preventDefault();
        (e.code === 'PageUp' ? props.onChannelUp : props.onChannelDown)?.();
        return;
      }
      if (e.code === 'Backspace') {
        e.preventDefault();
        props.onLastChannel?.();
        return;
      }
    }
    switch (e.code) {
      case 'Space':
      case 'KeyK':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'KeyF':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'KeyP':
        e.preventDefault();
        togglePiP();
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMute();
        flashVolume();
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekBy(5);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekBy(-5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        changeVolume((muted ? 0 : volume) + 0.05);
        flashVolume();
        break;
      case 'ArrowDown':
        e.preventDefault();
        changeVolume((muted ? 0 : volume) - 0.05);
        flashVolume();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (onMinimize) {
          onMinimize();
        } else {
          onClose();
        }
        break;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isMini) return;
    changeVolume((muted ? 0 : volume) + (e.deltaY < 0 ? 0.05 : -0.05));
    flashVolume();
  };

  // Keep keyboard shortcuts working after clicking a button or slider
  const refocus = () => {
    if (!isMini) containerRef.current?.focus();
  };

  // Entering mini leaves fullscreen; expanding takes keyboard focus back
  useEffect(() => {
    if (isMini) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.focus();
    }
  }, [isMini]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveVolume = muted ? 0 : volume;
  const volumeIcon = effectiveVolume === 0 ? '🔇' : effectiveVolume < 0.5 ? '🔉' : '🔊';
  const controlsVisible = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black flex items-center justify-center group outline-none ${
        !isMini && !controlsVisible ? 'cursor-none' : ''
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={refocus}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onDoubleClick={isMini ? onExpand : undefined}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
      />

      {isLive && !isMini && banner && !digits && (
        <div className="absolute bottom-28 left-8 z-40 px-5 py-3 rounded-xl bg-black/75 text-white pointer-events-none flex items-center gap-4">
          {props.channelNumber ? (
            <span className="text-2xl font-bold text-blue-300">{props.channelNumber}</span>
          ) : null}
          <span className="text-lg font-medium">{title}</span>
        </div>
      )}

      {isLive && !isMini && (digits || digitsMessage) && (
        <div className="absolute top-8 right-8 z-50 px-6 py-3 rounded-xl bg-black/80 text-white text-4xl font-bold tracking-widest pointer-events-none">
          {digits || <span className="text-lg font-medium tracking-normal text-red-300">{digitsMessage}</span>}
        </div>
      )}

      {volumeToast && !isMini && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-5 py-3 rounded-xl bg-black/70 text-white text-lg pointer-events-none">
          {volumeIcon} {Math.round(effectiveVolume * 100)}%
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-lg mb-2 font-semibold">Stream Error</div>
            <div className="text-white/70 text-sm mb-4">{error}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-blue-500/50 hover:bg-blue-500/70 text-white transition-colors"
            >
              Close Player
            </button>
          </div>
        </div>
      )}

      {isLoadingMessage && !error && (
        <div className={`absolute inset-0 flex items-center justify-center bg-black/60 z-40 ${isMini ? 'pointer-events-none' : ''}`}>
          <div className="text-center">
            <div className="animate-spin-slow mb-4 text-4xl">⟳</div>
            <div className="text-white text-sm">{isLoadingMessage}</div>
            {!isMini && (
              <button
                onClick={onClose}
                className="mt-5 px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/50 text-white text-sm transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mini player: compact overlay controls shown on hover */}
      {isMini && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <span className="text-white text-xs font-medium truncate">{title}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleMute}
              className="w-7 h-7 rounded bg-black/50 hover:bg-white/20 text-white text-sm"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {volumeIcon}
            </button>
            <button
              onClick={onExpand}
              className="w-7 h-7 rounded bg-black/50 hover:bg-white/20 text-white text-sm"
              title="Expand"
            >
              ⤢
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded bg-black/50 hover:bg-red-500/60 text-white text-sm"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Full player controls */}
      {!isMini && (
      <div
        className={`absolute inset-0 flex flex-col justify-between pointer-events-none 
          transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        onMouseMove={handleMouseMove}
      >
        {/* Top Bar */}
        <div className={`bg-black/70 m-4 p-4 rounded-lg ${controlsVisible ? 'pointer-events-auto' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-3">
              {title || 'Video Player'}
              {isLive && (
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                  LIVE
                </span>
              )}
              {isLive && recording && (
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-red-900 text-red-200 animate-pulse">
                  ● REC
                </span>
              )}
            </h3>
            <div className="flex items-center gap-4">
              {onMinimize && (
                <button
                  onClick={onMinimize}
                  className="text-white/60 hover:text-white transition-colors text-sm"
                  title="Minimize to mini player (Esc)"
                >
                  ⤡ Minimize
                </button>
              )}
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors text-xl"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className={`bg-black/70 m-4 p-4 rounded-lg ${controlsVisible ? 'pointer-events-auto' : ''}`}>
          {/* Progress Bar (not meaningful for live streams) */}
          {!isLive && (
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1 rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${
                    (currentTime / duration) * 100
                  }%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-white/60 mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Button Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="glass-button flex items-center justify-center w-10 h-10 p-0"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {!isLive && (
                <>
                  <button
                    onClick={() => seekBy(-5)}
                    className="glass-button flex items-center justify-center w-10 h-10 p-0"
                    title="Rewind 5s (←)"
                  >
                    ⟲ 5s
                  </button>

                  <button
                    onClick={() => seekBy(5)}
                    className="glass-button flex items-center justify-center w-10 h-10 p-0"
                    title="Forward 5s (→)"
                  >
                    5s ⟳
                  </button>
                </>
              )}

              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={toggleMute}
                  className="glass-button flex items-center justify-center w-10 h-10 p-0"
                  title={muted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {volumeIcon}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effectiveVolume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="w-28 h-1 rounded-full cursor-pointer"
                  style={{
                    padding: 0,
                    background: `linear-gradient(to right, #00d4ff ${effectiveVolume * 100}%, rgba(255,255,255,0.2) ${
                      effectiveVolume * 100
                    }%)`,
                  }}
                  title={`Volume ${Math.round(effectiveVolume * 100)}% (↑/↓ or mouse wheel)`}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {isLive && (
                <button
                  onClick={toggleRecording}
                  className={`glass-button flex items-center justify-center h-10 px-3 ${recording ? 'text-red-400' : ''}`}
                  title={recording ? 'Stop recording' : 'Record this channel (saved to your recordings folder)'}
                >
                  {recording ? '⏹ Stop REC' : '⏺ Record'}
                </button>
              )}
              {!isLive && (
                <div className="relative">
                  <button
                    onClick={toggleTrackMenu}
                    className="glass-button flex items-center justify-center h-10 px-3"
                    title="Audio & subtitles"
                  >
                    💬 Audio / Subs
                  </button>
                  {trackMenuOpen && (
                    <div className="absolute bottom-12 right-0 w-80 max-h-72 overflow-y-auto rounded-lg bg-black/90 border border-white/10 p-2 text-sm text-white">
                      {tracks.audio.length === 0 && tracks.subs.length === 0 && (
                        <div className="p-2 text-white/60">Loading tracks…</div>
                      )}
                      {tracks.audio.length > 0 && <div className="px-2 py-1 text-xs uppercase text-white/50">Audio</div>}
                      {tracks.audio.map((t: any) => (
                        <button
                          key={`a${t.index}`}
                          onClick={() => changeTrack('audio', t.index)}
                          className={`block w-full text-left px-2 py-1 rounded hover:bg-white/10 ${audioIndex === t.index ? 'text-cyan-300' : ''}`}
                        >
                          {audioIndex === t.index ? '✓ ' : ''}
                          {trackLabel(t, 'Track', t.index)}
                        </button>
                      ))}
                      {tracks.subs.length > 0 && <div className="px-2 py-1 text-xs uppercase text-white/50">Subtitles</div>}
                      {tracks.subs.length > 0 && (
                        <button
                          onClick={() => changeTrack('sub', -1)}
                          className={`block w-full text-left px-2 py-1 rounded hover:bg-white/10 ${subIndex === -1 ? 'text-cyan-300' : ''}`}
                        >
                          {subIndex === -1 ? '✓ ' : ''}Off
                        </button>
                      )}
                      {tracks.subs.map((t: any) =>
                        t.text ? (
                          <button
                            key={`s${t.index}`}
                            onClick={() => changeTrack('sub', t.index)}
                            className={`block w-full text-left px-2 py-1 rounded hover:bg-white/10 ${subIndex === t.index ? 'text-cyan-300' : ''}`}
                          >
                            {subIndex === t.index ? '✓ ' : ''}
                            {trackLabel(t, 'Subtitle', t.index)}
                          </button>
                        ) : (
                          <div key={`s${t.index}`} className="px-2 py-1 text-white/30">
                            {trackLabel(t, 'Subtitle', t.index)} (image-based, unsupported)
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={togglePiP}
                className="glass-button flex items-center justify-center w-10 h-10 p-0"
                title="Picture in Picture (P)"
              >
                {isPiP ? '◉' : '◯'}
              </button>

              <button
                onClick={toggleFullscreen}
                className="glass-button flex items-center justify-center w-10 h-10 p-0"
                title="Fullscreen (F)"
              >
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {!isMini && controlsVisible && (
        <div className="absolute bottom-1 left-4 text-xs text-white/30 pointer-events-none">
          Space/K: Play/Pause | F: Fullscreen | P: PiP | M: Mute | ↑↓: Volume
          {!isLive && ' | ←→: Seek'}
          {isLive && ' | PgUp/PgDn: Channel | 0-9: Go to number | Backspace: Last channel'} | Esc: {onMinimize ? 'Minimize' : 'Close'}
        </div>
      )}
    </div>
  );
};
