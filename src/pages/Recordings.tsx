import React, { useCallback, useEffect, useState } from 'react';
import { useLivePlayer } from '../components/LivePlayerContext';

const invoke = (channel: string, data?: any) => window.electron.ipcRenderer.invoke(channel, data);

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;

const formatElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
};

export const Recordings = () => {
  const { playMedia } = useLivePlayer();
  const [active, setActive] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [dir, setDir] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    const [act, list, sched] = await Promise.all([
      invoke('get-active-recordings'),
      invoke('list-recordings'),
      invoke('list-schedules'),
    ]);
    setActive(act || []);
    // Schedules that are already recording show under "In progress"
    setSchedules((sched || []).filter((s: any) => s.status !== 'recording'));
    if (list?.success) {
      setFiles(list.data.files);
      setDir(list.data.dir);
    } else {
      setError(list?.error || 'Could not read the recordings folder');
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const stop = async (id: string) => {
    await invoke('stop-recording', { id });
    setTimeout(refresh, 1500);
  };

  const remove = async (file: string) => {
    await invoke('delete-recording', { file });
    setConfirmDelete(null);
    refresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold gradient-text">Recordings</h1>
          <button onClick={() => invoke('open-recordings-folder')} className="glass-button px-4 py-2 text-sm">
            Open folder
          </button>
        </div>
        <p className="text-xs text-white/40 mb-6 truncate" title={dir}>
          Saved to {dir || '…'} (change this in Settings)
        </p>

        {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-200 text-sm">{error}</div>}

        {active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">In progress</h2>
            <div className="space-y-2">
              {active.map((r) => (
                <div key={r.id} className="glass-card p-4 rounded-lg border border-white/10 flex items-center gap-4">
                  <span className={`text-lg ${r.status === 'recording' ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                    {r.status === 'recording' ? '●' : '⚠'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{r.name}</div>
                    <div className="text-xs text-white/50 truncate">
                      {r.status === 'recording'
                        ? `${formatElapsed(now - r.startedAt)} · ${formatSize(r.size)}`
                        : `Failed: ${r.error || 'unknown error'}`}
                    </div>
                  </div>
                  <button onClick={() => stop(r.id)} className="glass-button px-4 py-2 text-sm">
                    {r.status === 'recording' ? '⏹ Stop' : 'Dismiss'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {schedules.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-1">Scheduled</h2>
            <p className="text-xs text-white/40 mb-3">KnackeredTV must be running when a scheduled recording starts.</p>
            <div className="space-y-2">
              {schedules.map((s) => (
                <div key={s.id} className="glass-card p-4 rounded-lg border border-white/10 flex items-center gap-4">
                  <span className={`text-lg ${s.status === 'scheduled' ? 'text-blue-300' : 'text-yellow-400'}`}>
                    {s.status === 'scheduled' ? '⏰' : '⚠'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{s.name}</div>
                    <div className="text-xs text-white/50 truncate">
                      {new Date(s.start).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {s.status === 'missed' && ' · Missed (app was closed)'}
                      {s.status === 'failed' && ` · Failed: ${s.error || 'could not start'}`}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await invoke('cancel-schedule', { id: s.id });
                      refresh();
                    }}
                    className="glass-button px-4 py-2 text-sm"
                  >
                    {s.status === 'scheduled' ? 'Cancel' : 'Dismiss'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mb-3">Saved recordings</h2>
        {files.length === 0 ? (
          <div className="glass-card p-8 rounded-lg border border-white/10 text-center text-white/50 text-sm">
            Nothing recorded yet. Open a live channel and press <b>⏺ Record</b>.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.file} className="glass-card p-4 rounded-lg border border-white/10 flex items-center gap-4">
                <button
                  onClick={() => playMedia({ url: f.file, title: f.name })}
                  className="w-10 h-10 rounded-full bg-blue-500/30 hover:bg-blue-500/50 text-white shrink-0"
                  title="Play"
                >
                  ▶
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{f.name}</div>
                  <div className="text-xs text-white/50">
                    {formatSize(f.size)} · {new Date(f.modified).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => invoke('show-recording', { file: f.file })} className="text-white/60 hover:text-white text-sm">
                  Show
                </button>
                {confirmDelete === f.file ? (
                  <>
                    <button onClick={() => remove(f.file)} className="text-red-300 hover:text-red-200 text-sm font-medium">
                      Confirm delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-white/60 hover:text-white text-sm">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(f.file)} className="text-white/60 hover:text-red-300 text-sm">
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
