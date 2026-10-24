const { app, BrowserWindow, ipcMain, Menu, session, dialog, shell } = require('electron' /* webpackIgnore: true */);
const path = require('path' /* webpackIgnore: true */);
const { db } = require('../db/index');
const { XtreamAPIClient } = require('../utils/xtreamApi');

const http = require('http' /* webpackIgnore: true */);
const { spawn } = require('child_process' /* webpackIgnore: true */);

import type { BrowserWindow as BrowserWindowType } from 'electron';

const isDevelopment = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindowType | null = null;

// Mirror all console output (main + renderer) to a log file for debugging
const fs = require('fs' /* webpackIgnore: true */);
// Installed builds live in a read-only archive, so logs go to the user data folder there
const logDir = app.isPackaged ? path.join(app.getPath('userData'), 'logs') : path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'app.log');
try {
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(logFile, `--- session ${new Date().toISOString()} ---\n`);
} catch {}
const writeLog = (source: string, level: string, message: string) => {
  try {
    const safe = String(message).replace(/(\/(?:movie|series|live|timeshift)\/)[^/\s]+\/[^/\s]+\//g, '$1***/***/');
    fs.appendFileSync(logFile, `${new Date().toISOString()} [${source}] ${level}: ${safe}\n`);
  } catch {}
};
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  const original = (console as any)[level].bind(console);
  (console as any)[level] = (...args: any[]) => {
    original(...args);
    writeLog('main', level, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}

// Keep rendering/capturing frames when the window is covered or backgrounded
// (otherwise Discord screen share goes black after switching windows)
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Resolve at runtime from node_modules (webpack would otherwise rewrite the path)
function getFfmpegPath(): string {
  let ffmpegPath: string = path.join(app.getAppPath(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpegPath)) ffmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

const TEXT_SUBTITLE_CODECS = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'];

// ---- Settings and recordings ----
interface ParentalConfig {
  salt?: string;
  hash?: string;
  locked: { live: string[]; movie: string[]; series: string[] };
}
interface RecordingSchedule {
  id: string;
  name: string;
  src: string;
  // Programme times; recording starts a little early and ends a little late
  start: number;
  end: number;
  status: 'scheduled' | 'recording' | 'missed' | 'failed';
  error?: string;
}
interface AppSettings {
  recordingsDir?: string;
  parental?: Record<string, ParentalConfig>;
  schedules?: RecordingSchedule[];
}
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings(): AppSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(settings: AppSettings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}
const defaultRecordingsDir = () => path.join(app.getPath('videos'), 'KnackeredTV');
const getRecordingsDir = () => readSettings().recordingsDir || defaultRecordingsDir();
function isInsideRecordingsDir(file: string): boolean {
  if (!file) return false;
  const root = path.resolve(getRecordingsDir()) + path.sep;
  return path.resolve(file).toLowerCase().startsWith(root.toLowerCase());
}

// ---- Parental controls: a PIN per profile plus the categories it locks ----
const nodeCrypto = require('crypto' /* webpackIgnore: true */);
const hashPin = (pin: string, salt: string) => nodeCrypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
const validPin = (pin: any) => /^\d{4,8}$/.test(String(pin ?? ''));
const emptyParental = (): ParentalConfig => ({ locked: { live: [], movie: [], series: [] } });
const getParental = (profileId: string): ParentalConfig => {
  const saved = readSettings().parental?.[profileId];
  return { ...emptyParental(), ...saved, locked: { ...emptyParental().locked, ...(saved?.locked || {}) } };
};
const saveParental = (profileId: string, config: ParentalConfig) => {
  const settings = readSettings();
  writeSettings({ ...settings, parental: { ...(settings.parental || {}), [profileId]: config } });
};
const publicParental = (config: ParentalConfig) => ({ hasPin: !!config.hash, locked: config.locked });

// Slows down PIN guessing: 5 wrong tries lock verification for 30 seconds
const pinFailures = new Map<string, { count: number; until: number }>();
function checkPin(profileId: string, pin: any): { ok: boolean; error?: string } {
  const config = getParental(profileId);
  if (!config.hash || !config.salt) return { ok: true };
  const state = pinFailures.get(profileId) || { count: 0, until: 0 };
  if (state.until > Date.now()) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((state.until - Date.now()) / 1000)}s` };
  }
  const given = Buffer.from(hashPin(String(pin ?? ''), config.salt), 'hex');
  const ok = nodeCrypto.timingSafeEqual(given, Buffer.from(config.hash, 'hex'));
  if (ok) {
    pinFailures.delete(profileId);
    return { ok: true };
  }
  const count = state.count + 1;
  pinFailures.set(profileId, { count: count >= 5 ? 0 : count, until: count >= 5 ? Date.now() + 30000 : 0 });
  return { ok: false, error: count >= 5 ? 'Too many attempts. Try again in 30s' : 'Wrong PIN' };
}

ipcMain.handle('parental-get', async (_event, { profileId }: any) => publicParental(getParental(profileId)));
ipcMain.handle('parental-verify', async (_event, { profileId, pin }: any) => checkPin(profileId, pin));
ipcMain.handle('parental-set-pin', async (_event, { profileId, pin, currentPin }: any) => {
  if (!validPin(pin)) return { success: false, error: 'PIN must be 4 to 8 digits' };
  const check = checkPin(profileId, currentPin);
  if (!check.ok) return { success: false, error: check.error };
  const salt = nodeCrypto.randomBytes(16).toString('hex');
  const config = getParental(profileId);
  saveParental(profileId, { ...config, salt, hash: hashPin(String(pin), salt) });
  return { success: true, data: publicParental(getParental(profileId)) };
});
ipcMain.handle('parental-remove-pin', async (_event, { profileId, pin }: any) => {
  const check = checkPin(profileId, pin);
  if (!check.ok) return { success: false, error: check.error };
  saveParental(profileId, emptyParental());
  return { success: true, data: publicParental(emptyParental()) };
});
ipcMain.handle('parental-set-locked', async (_event, { profileId, kind, categoryIds }: any) => {
  if (!['live', 'movie', 'series'].includes(kind)) return { success: false, error: 'Bad kind' };
  const config = getParental(profileId);
  if (!config.hash) return { success: false, error: 'Set a PIN first' };
  config.locked[kind as 'live'] = Array.from(new Set((categoryIds || []).map(String)));
  saveParental(profileId, config);
  return { success: true, data: publicParental(config) };
});

ipcMain.handle('get-settings', async () => {
  const saved = readSettings();
  return { recordingsDir: getRecordingsDir(), isDefaultDir: !saved.recordingsDir };
});
ipcMain.handle('choose-recordings-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose recordings folder',
    defaultPath: getRecordingsDir(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result.canceled && result.filePaths[0]) writeSettings({ ...readSettings(), recordingsDir: result.filePaths[0] });
  return { recordingsDir: getRecordingsDir(), isDefaultDir: !readSettings().recordingsDir };
});
ipcMain.handle('reset-recordings-folder', async () => {
  const { recordingsDir, ...rest } = readSettings();
  writeSettings(rest);
  return { recordingsDir: getRecordingsDir(), isDefaultDir: true };
});
ipcMain.handle('open-recordings-folder', async () => {
  const dir = getRecordingsDir();
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
});

interface ActiveRecording {
  id: string;
  name: string;
  src: string;
  file: string;
  startedAt: number;
  status: 'recording' | 'failed';
  error?: string;
  stopping: boolean;
  proc: any;
}
const activeRecordings = new Map<string, ActiveRecording>();
const safeFileName = (name: string) => String(name || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Recording';
const fileStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`;
};
const publicRecording = (r: ActiveRecording) => {
  let size = 0;
  try {
    size = fs.statSync(r.file).size;
  } catch {}
  return { id: r.id, name: r.name, src: r.src, file: r.file, startedAt: r.startedAt, status: r.status, error: r.error, size };
};

function stopRecording(r: ActiveRecording) {
  if (r.status === 'failed') {
    activeRecordings.delete(r.id);
    return;
  }
  r.stopping = true;
  // "q" lets ffmpeg finish the file cleanly; kill is only a fallback
  try {
    r.proc.stdin.write('q');
  } catch {}
  setTimeout(() => {
    try {
      r.proc.kill('SIGKILL');
    } catch {}
  }, 5000);
}

function startRecording({ src: rawSrc, name, durationSec }: any) {
  try {
    const src = String(rawSrc || '').replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '');
    if (!isHttp(src)) throw new Error('Invalid stream URL');
    for (const r of activeRecordings.values()) {
      if (r.src === src && r.status === 'recording') return { success: true, data: publicRecording(r) };
    }
    const dir = getRecordingsDir();
    fs.mkdirSync(dir, { recursive: true });
    const base = `${safeFileName(name)} - ${fileStamp()}`;
    let file = path.join(dir, `${base}.mkv`);
    for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${base} (${n}).mkv`);

    const isHls = /\.m3u8(\?|$)/i.test(src);
    const args = [
      '-hide_banner', '-nostats', '-loglevel', 'warning',
      ...httpInputArgs(src),
      '-i', src,
      // HLS masters expose every variant; take a single video and audio track there
      '-map', '0:v:0?', '-map', isHls ? '0:a:0?' : '0:a?',
      '-c', 'copy',
      ...(durationSec > 0 ? ['-t', String(Math.round(durationSec))] : []),
      '-y', file,
    ];
    const proc = spawn(getFfmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
    const rec: ActiveRecording = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(name || 'Recording'),
      src,
      file,
      startedAt: Date.now(),
      status: 'recording',
      stopping: false,
      proc,
    };
    activeRecordings.set(rec.id, rec);
    let errText = '';
    proc.stderr.on('data', (d: any) => {
      errText = (errText + String(d)).slice(-1500);
    });
    proc.stdin.on('error', () => {});
    proc.on('error', (e: any) => {
      rec.status = 'failed';
      rec.error = e.message;
    });
    proc.on('exit', (code: any) => {
      console.log('[record] ffmpeg exited', code, path.basename(file));
      if (rec.stopping || code === 0) {
        activeRecordings.delete(rec.id);
        return;
      }
      rec.status = 'failed';
      rec.error = errText.trim().split(/\r?\n/).slice(-2).join(' ') || `ffmpeg exited with code ${code}`;
      console.warn('[record] failed:', rec.error);
      try {
        if (fs.statSync(file).size < 10240) fs.rmSync(file, { force: true });
      } catch {}
    });
    console.log('[record] started', path.basename(file));
    return { success: true, data: publicRecording(rec) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
ipcMain.handle('start-recording', async (_event, args: any) => startRecording(args));

// ---- Scheduled recordings ----
// Checked every few seconds while the app is running; schedules are saved so they survive restarts
const SCHEDULE_LEAD_MS = 60 * 1000;
const SCHEDULE_TAIL_MS = 3 * 60 * 1000;
const getSchedules = (): RecordingSchedule[] => readSettings().schedules || [];
const saveSchedules = (schedules: RecordingSchedule[]) => writeSettings({ ...readSettings(), schedules });

function runSchedules() {
  const now = Date.now();
  const schedules = getSchedules();
  let changed = false;
  for (const s of schedules) {
    if (s.status === 'scheduled' && now >= s.start - SCHEDULE_LEAD_MS) {
      const endsAt = s.end + SCHEDULE_TAIL_MS;
      if (now >= endsAt) {
        s.status = 'missed';
      } else {
        const result: any = startRecording({ src: s.src, name: s.name, durationSec: (endsAt - now) / 1000 });
        s.status = result.success ? 'recording' : 'failed';
        if (!result.success) s.error = result.error;
        console.log('[schedule]', s.status, s.name);
      }
      changed = true;
    }
  }
  // Finished and cancelled entries are dropped after a day so the list stays short
  const kept = schedules.filter((s) => s.end + SCHEDULE_TAIL_MS + 24 * 3600 * 1000 > now && !(s.status === 'recording' && now > s.end + SCHEDULE_TAIL_MS + 60000));
  if (kept.length !== schedules.length) changed = true;
  if (changed) saveSchedules(kept);
}

ipcMain.handle('schedule-recording', async (_event, { src: rawSrc, name, start, end }: any) => {
  const src = String(rawSrc || '').replace(/[\u200B-\u200F\u2060\uFEFF\s]/g, '');
  if (!isHttp(src)) return { success: false, error: 'Invalid stream URL' };
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { success: false, error: 'Invalid time' };
  if (end + SCHEDULE_TAIL_MS <= Date.now()) return { success: false, error: 'That programme has already finished' };
  const schedules = getSchedules();
  if (schedules.some((s) => s.src === src && s.start === start && s.status === 'scheduled')) return { success: true };
  schedules.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || 'Recording'),
    src,
    start,
    end,
    status: 'scheduled',
  });
  saveSchedules(schedules);
  runSchedules();
  return { success: true };
});

ipcMain.handle('list-schedules', async () => getSchedules().sort((a, b) => a.start - b.start));

ipcMain.handle('cancel-schedule', async (_event, { id }: any) => {
  saveSchedules(getSchedules().filter((s) => s.id !== id));
  return { success: true };
});

ipcMain.handle('stop-recording', async (_event, { id }: any) => {
  const rec = activeRecordings.get(id);
  if (rec) stopRecording(rec);
  return { success: true };
});

ipcMain.handle('get-active-recordings', async () => Array.from(activeRecordings.values()).map(publicRecording));

ipcMain.handle('list-recordings', async () => {
  try {
    const dir = getRecordingsDir();
    const busy = new Set(Array.from(activeRecordings.values()).map((r) => r.file));
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f: string) => /\.(mkv|ts|mp4)$/i.test(f))
          .map((f: string) => {
            const file = path.join(dir, f);
            const stat = fs.statSync(file);
            return { name: f.replace(/\.\w+$/, ''), file, size: stat.size, modified: stat.mtimeMs };
          })
          .filter((f: any) => !busy.has(f.file))
          .sort((a: any, b: any) => b.modified - a.modified)
      : [];
    return { success: true, data: { dir, files } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-recording', async (_event, { file }: any) => {
  try {
    if (!isInsideRecordingsDir(file)) throw new Error('Not a recording');
    fs.rmSync(file, { force: true });
    probeCache.delete(file);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('show-recording', async (_event, { file }: any) => {
  if (isInsideRecordingsDir(file)) shell.showItemInFolder(file);
});

// Duration and track list of a stream or recording, so the player can show a seek bar up front
ipcMain.handle('probe-media', async (_event, { src }: any) => {
  if (!isHttp(src || '') && !isInsideRecordingsDir(src)) return { duration: 0 };
  const probe = await probeSource(src);
  return { duration: probe.duration, tracks: probe.tracks };
});

interface TrackInfo {
  audio: { index: number; lang: string; title: string; codec: string; channels: string }[];
  subs: { index: number; lang: string; title: string; codec: string; text: boolean }[];
}

// ffmpeg prints the input's streams on stderr; this reads the audio and subtitle tracks from that
function parseTracks(stderrText: string): TrackInfo {
  const info: TrackInfo = { audio: [], subs: [] };
  let current: any = null;
  for (const line of stderrText.split(/\r?\n/)) {
    if (/^Output #0/.test(line)) break;
    const stream = /Stream #0:\d+(?:\[[^\]]*\])?(?:\((\w+)\))?: (Audio|Subtitle|Video): (\w+)(.*)/.exec(line);
    if (stream) {
      const [, lang, type, codec, rest] = stream;
      current = null;
      if (type === 'Audio') {
        const channels = /Hz, ([^,]+)/.exec(rest)?.[1] || '';
        current = { index: info.audio.length, lang: lang || '', title: '', codec, channels };
        info.audio.push(current);
      } else if (type === 'Subtitle') {
        current = { index: info.subs.length, lang: lang || '', title: '', codec, text: TEXT_SUBTITLE_CODECS.includes(codec) };
        info.subs.push(current);
      }
      continue;
    }
    const title = /^\s+title\s*:\s*(.+)$/.exec(line);
    if (title && current && !current.title) current.title = title[1].trim();
  }
  return info;
}

let transcodeTracks: TrackInfo = { audio: [], subs: [] };
let lastTranscodeSrc = '';

// One short ffmpeg read of the file header: video codec + audio/subtitle tracks (cached per source)
const probeCache = new Map<string, { vcodec: string; duration: number; tracks: TrackInfo }>();
const isHttp = (src: string) => /^https?:\/\//i.test(src);
// HTTP-only demuxer options make ffmpeg bail out when given a local file
const httpInputArgs = (src: string) =>
  isHttp(src)
    ? ['-user_agent', session.defaultSession.getUserAgent(), '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
    : [];

function probeSource(src: string): Promise<{ vcodec: string; duration: number; tracks: TrackInfo }> {
  const cached = probeCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    let text = '';
    const finish = () => {
      const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      const result = {
        vcodec: /Stream #0:\d+(?:\[[^\]]*\])?(?:\(\w+\))?: Video: (\w+)/.exec(text)?.[1] || '',
        duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
        tracks: parseTracks(text),
      };
      if (result.vcodec) probeCache.set(src, result);
      resolve(result);
    };
    const p = spawn(getFfmpegPath(), ['-hide_banner', ...(isHttp(src) ? ['-user_agent', session.defaultSession.getUserAgent()] : []), '-i', src], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const timer = setTimeout(() => p.kill('SIGKILL'), 20000);
    p.stderr.on('data', (d: any) => {
      if (text.length < 200000) text += String(d);
    });
    p.on('close', () => {
      clearTimeout(timer);
      finish();
    });
    p.on('error', () => {
      clearTimeout(timer);
      finish();
    });
  });
}
let subtitleFile = path.join(require('os').tmpdir(), 'knackeredtv-subs.vtt');
ipcMain.handle('get-transcode-tracks', async () => transcodeTracks);

// Chromium in Electron cannot decode AC3/EAC3/DTS audio, which most movies use.
// This local server remuxes a stream with the audio transcoded to AAC.
let transcodePort = 0;
let transcodeLog: string[] = [];
ipcMain.handle('get-transcode-log', async () => transcodeLog.join('\n'));
function startTranscodeServer(): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req: any, res: any) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/subs') {
        res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        try {
          const data = fs.readFileSync(subtitleFile);
          console.log('[subs] serving', data.length, 'bytes');
          res.end(data);
        } catch {
          console.log('[subs] no file yet');
          res.end('WEBVTT\n\n');
        }
        return;
      }
      const params = url.searchParams;
      const rawSrc = params.get('src') || '';
      // Strip zero-width/invisible characters that can sneak into pasted server URLs
      const cleaned = rawSrc.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
      const src = isHttp(cleaned.trim()) ? cleaned.replace(/\s/g, '') : cleaned;
      const start = Math.max(0, parseFloat(params.get('start') || '0') || 0);
      // Local files are only served from the recordings folder
      if (!isHttp(src) && !isInsideRecordingsDir(src)) {
        res.writeHead(400);
        res.end();
        return;
      }
      const ffmpegPath = getFfmpegPath();
      const reencode = params.get('venc') === '1';
      const audioIndex = Math.max(0, parseInt(params.get('audio') || '0', 10) || 0);
      const subIndex = parseInt(params.get('sub') ?? '-1', 10);
      const probe = await probeSource(src);
      transcodeTracks = probe.tracks;
      lastTranscodeSrc = src;
      try {
        fs.rmSync(subtitleFile, { force: true });
      } catch {}
      const args = [
        '-hide_banner', '-nostats', '-loglevel', 'warning',
        '-fflags', '+genpts',
        ...httpInputArgs(src),
        ...(start > 0 ? ['-noaccurate_seek', '-ss', String(start)] : []),
        '-i', src,
        '-avoid_negative_ts', 'make_zero',
        '-map', '0:v:0', '-map', `0:a:${audioIndex}?`,
        ...(reencode
          ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p']
          : ['-c:v', 'copy', ...(probe.vcodec === 'hevc' ? ['-tag:v', 'hvc1'] : [])]),
        '-c:a', 'aac', '-ac', '2', '-b:a', '192k',
        '-sn',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1',
        // Second output of the same read: the chosen text subtitle track as WebVTT
        ...(subIndex >= 0 ? ['-map', `0:s:${subIndex}`, '-c:s', 'webvtt', '-flush_packets', '1', '-f', 'webvtt', '-y', subtitleFile] : []),
      ];
      transcodeLog = [];
      const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      ff.stderr.on('data', (d: any) => {
        const text = String(d);
        transcodeLog.push(text.trim());
        // The info-level header is noisy; only real problems go to the log file
        if (/error|fail|invalid|unable|could not|not found|denied|subtitle|webvtt|matches no streams/i.test(text)) console.warn('[ffmpeg]', text.trim());
      });
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' });
      ff.stdout.pipe(res);
      const stop = () => ff.kill('SIGKILL');
      res.on('close', stop);
      ff.on('exit', (code: any) => console.log('[ffmpeg] exited', code, src.replace(/\/[^/]+\/[^/]+\/(\d+\.\w+)$/, '/***/***/$1')));
      ff.on('error', (e: any) => { console.error('[ffmpeg] spawn failed', ffmpegPath, e.message); res.end(); });
    });
    server.listen(0, '127.0.0.1', () => {
      transcodePort = server.address().port;
      resolve(transcodePort);
    });
  });
}

ipcMain.handle('get-transcode-base', async () =>
  `http://127.0.0.1:${transcodePort || (await startTranscodeServer())}/`
);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, './preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../../assets/knfav.png'),
  });

  const startUrl = isDevelopment
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../dist/renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  const levels = ['verbose', 'info', 'warn', 'error'];
  mainWindow.webContents.on('console-message', (event: any, lvl?: any, msg?: any) => {
    // Newer Electron passes a single details object; older passes positional args
    const level = event?.level ?? lvl;
    const message = event?.message ?? msg;
    writeLog('renderer', typeof level === 'string' ? level : levels[level] || 'log', message);
  });
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    await db.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // IPTV providers don't send CORS headers; the player fetches streams from the file:// renderer
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    const headers = { ...details.responseHeaders };
    if (/^https?:/i.test(details.url)) {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase().startsWith('access-control-allow-')) delete headers[key];
      }
      headers['Access-Control-Allow-Origin'] = ['*'];
      headers['Access-Control-Allow-Headers'] = ['*'];
      headers['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
    }
    callback({ responseHeaders: headers });
  });

  createWindow();
  createMenu();
  runSchedules();
  setInterval(runSchedules, 15000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  for (const r of activeRecordings.values()) {
    try {
      r.proc.stdin.write('q');
    } catch {}
  }
  await db.close();
});

// IPC Handlers - Profiles
ipcMain.handle('save-profile', async (_event, profile: any) => {
  try {
    await db.saveProfile(profile);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-profiles', async () => {
  try {
    const profiles = await db.getProfiles();
    return { success: true, data: profiles };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-profile', async (_event, id: string) => {
  try {
    const profile = await db.getProfile(id);
    return { success: true, data: profile };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-profile', async (_event, id: string) => {
  try {
    await db.deleteProfile(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// IPC Handlers - Authentication
ipcMain.handle('authenticate', async (_event, { serverUrl, username, password }) => {
  try {
    const client = new XtreamAPIClient(serverUrl, username, password);
    const accountInfo = await client.authenticate();
    return { success: true, data: accountInfo };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// IPC Handlers - Live TV
ipcMain.handle('get-live-categories', async (_event, { serverUrl, username, password }) => {
  try {
    const client = new XtreamAPIClient(serverUrl, username, password);
    const categories = await client.getLiveCategories();
    return { success: true, data: categories };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-live-channels', async (_event, { serverUrl, username, password, categoryId }) => {
  try {
    const client = new XtreamAPIClient(serverUrl, username, password);
    const channels = await client.getLiveChannels(categoryId);
    return { success: true, data: channels };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// IPC Handlers - EPG (short guide per channel, cached for a few minutes)
const epgCache = new Map<string, { at: number; data: any[] }>();
const EPG_TTL = 5 * 60 * 1000;
ipcMain.handle('get-epg', async (_event, { serverUrl, username, password, streamIds }) => {
  try {
    const client = new XtreamAPIClient(serverUrl, username, password);
    const result: Record<string, any[]> = {};
    const queue: string[] = [...streamIds];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift() as string;
        const key = `${serverUrl}|${username}|${id}`;
        const cached = epgCache.get(key);
        if (cached && Date.now() - cached.at < EPG_TTL) {
          result[id] = cached.data;
          continue;
        }
        const data = await client.getShortEpg(id, 12);
        epgCache.set(key, { at: Date.now(), data });
        result[id] = data;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// IPC Handlers - VOD (movies & series)
const xtreamHandler = (call: (client: any, args: any) => Promise<any>) =>
  async (_event: any, { serverUrl, username, password, ...args }: any) => {
    try {
      const client = new XtreamAPIClient(serverUrl, username, password);
      return { success: true, data: await call(client, args) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

ipcMain.handle('get-epg-full', xtreamHandler((c, a) => c.getFullEpg(a.streamId)));
ipcMain.handle('get-catchup-url', xtreamHandler((c, a) => c.getCatchupUrl(a.streamId, a.start, a.end)));
ipcMain.handle('get-movie-categories', xtreamHandler((c) => c.getMovieCategories()));
ipcMain.handle('get-movies', xtreamHandler((c, a) => c.getMovies(a.categoryId)));
ipcMain.handle('get-movie-info', xtreamHandler((c, a) => c.getMovieInfo(a.id)));
ipcMain.handle('get-series-categories', xtreamHandler((c) => c.getSeriesCategories()));
ipcMain.handle('get-series', xtreamHandler((c, a) => c.getSeries(a.categoryId)));
ipcMain.handle('get-series-info', xtreamHandler((c, a) => c.getSeriesInfo(a.id)));

// IPC Handlers - Playback History
ipcMain.handle(
  'save-playback-position',
  async (_event, { type, contentId, position, duration, watched, meta }) => {
    try {
      await db.savePlaybackPosition(type, contentId, position, duration, watched, meta);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

ipcMain.handle('get-playback-position', async (_event, { type, contentId }) => {
  try {
    const position = await db.getPlaybackPosition(type, contentId);
    return { success: true, data: position };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-playback-history', async (_event, { type }) => {
  try {
    return { success: true, data: await db.getPlaybackHistory(type) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-continue-watching', async (_event, limit = 20) => {
  try {
    const items = await db.getContinueWatching(limit);
    return { success: true, data: items };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// IPC Handlers - Favorites
ipcMain.handle('get-favorites', async (_event, { profileId }) => {
  try {
    return { success: true, data: await db.getFavorites(profileId) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('toggle-favorite', async (_event, { profileId, kind, itemId, data }) => {
  try {
    return { success: true, data: await db.toggleFavorite(profileId, kind, String(itemId), data) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

function createMenu() {
  const template: any = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.reload();
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
