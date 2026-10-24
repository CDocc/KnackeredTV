import React, { useEffect, useState } from 'react';
import { ParentalSettings } from '../components/ParentalSettings';

interface SettingsProps {
  profile: any;
  onLogout: () => void;
}

export const Settings = (props: SettingsProps) => {
  const { profile, onLogout } = props;
  const [settings, setSettings] = useState({
    hardwareDecoding: true,
    bufferSize: 5000,
    userAgent: 'KnackeredTV/1.0',
    deinterlace: false,
    audioTrack: 0,
    subtitleTrack: -1,
  });

  const [recordingsDir, setRecordingsDir] = useState('');
  const [isDefaultDir, setIsDefaultDir] = useState(true);
  useEffect(() => {
    window.electron.ipcRenderer.invoke('get-settings').then((s: any) => {
      setRecordingsDir(s.recordingsDir);
      setIsDefaultDir(s.isDefaultDir);
    });
  }, []);
  const applyFolder = (s: any) => {
    setRecordingsDir(s.recordingsDir);
    setIsDefaultDir(s.isDefaultDir);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-3xl mx-auto">
        <div className="glass-panel p-8 rounded-xl border border-white/10">
          <h1 className="text-3xl font-bold gradient-text mb-8">Settings</h1>

          {/* Profile Info */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Profile Information</h2>
            <div className="glass-card p-4 rounded-lg space-y-3 mb-4 border border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Profile Name:</span>
                <span className="font-medium text-white">{profile.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-white/60">Server:</span>
                <span className="font-medium text-sm text-right max-w-xs truncate">{profile.serverUrl}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Username:</span>
                <span className="font-medium text-white">{profile.username}</span>
              </div>
            </div>
          </div>

          {/* Recordings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Recordings</h2>
            <div className="glass-card p-4 rounded-lg border border-white/10">
              <label className="font-medium block mb-2 text-white">Recordings folder</label>
              <div className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white/80 break-all mb-3">
                {recordingsDir || '…'}
                {isDefaultDir && <span className="text-white/40"> (default)</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => applyFolder(await window.electron.ipcRenderer.invoke('choose-recordings-folder'))}
                  className="glass-button px-4 py-2 text-sm"
                >
                  Change folder…
                </button>
                <button
                  onClick={() => window.electron.ipcRenderer.invoke('open-recordings-folder')}
                  className="glass-button px-4 py-2 text-sm"
                >
                  Open
                </button>
                {!isDefaultDir && (
                  <button
                    onClick={async () => applyFolder(await window.electron.ipcRenderer.invoke('reset-recordings-folder'))}
                    className="glass-button px-4 py-2 text-sm"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <p className="text-sm text-white/40 mt-2">
                New recordings are saved here. Existing recordings stay where they are and only show on the Recordings
                page while they are in the selected folder.
              </p>
            </div>
          </div>

          <ParentalSettings profile={profile} />

          {/* Playback Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Playback Settings</h2>
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium text-white">Hardware Decoding</label>
                  <input
                    type="checkbox"
                    checked={settings.hardwareDecoding}
                    onChange={(e) =>
                      handleSettingChange('hardwareDecoding', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                </div>
                <p className="text-sm text-white/40">
                  Use GPU for video decoding to reduce CPU usage
                </p>
              </div>

              <div className="glass-card p-4 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium text-white">Deinterlace</label>
                  <input
                    type="checkbox"
                    checked={settings.deinterlace}
                    onChange={(e) =>
                      handleSettingChange('deinterlace', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                </div>
                <p className="text-sm text-white/40">
                  Remove interlacing artifacts from video
                </p>
              </div>

              <div className="glass-card p-4 rounded-lg border border-white/10">
                <label className="font-medium block mb-2 text-white">
                  Buffer Size (ms): {settings.bufferSize}
                </label>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={settings.bufferSize}
                  className="w-full"
                />
                <p className="text-sm text-white/40 mt-2">
                  Larger buffer = more stable playback but higher latency
                </p>
              </div>
            </div>
          </div>

          {/* Network Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Network Settings</h2>
            <div className="glass-card p-4 rounded-lg border border-white/10">
              <label className="font-medium block mb-2 text-white">User Agent</label>
              <input
                type="text"
                value={settings.userAgent}
                onChange={(e) =>
                  handleSettingChange('userAgent', e.target.value)
                }
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50"
                placeholder="User-Agent string"
              />
              <p className="text-sm text-white/40 mt-2">
                Custom user agent for stream requests
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Danger Zone</h2>
            <div className="glass-card p-4 rounded-lg border border-red-500/30">
              <button
                onClick={onLogout}
                className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 
                  text-red-200 font-medium py-2 px-4 rounded-lg transition-all"
              >
                Logout & Clear Profile
              </button>
              <p className="text-sm text-white/40 mt-2">
                This will remove the current profile and logged-in session
              </p>
            </div>
          </div>

          {/* About */}
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-white/40">
            <p>KnackeredTV v0.1.0</p>
            <p className="mt-2">Modern IPTV Player for Windows</p>
          </div>
        </div>
      </div>
    </div>
  );
};
