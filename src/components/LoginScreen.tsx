import React, { useState } from 'react';
import logo from '../../assets/kntvlogo.png';
import { M3U_USER, PUBLIC_PLAYLISTS, isM3uProfile } from '../utils/profileKind';

interface LoginScreenProps {
  onLoginSuccess: (profile: any) => void;
}

type Source = 'xtream' | 'public' | 'private';

const EMPTY_FORM = {
  profileName: '',
  serverUrl: '',
  username: '',
  password: '',
  m3uUrl: '',
  publicUrl: PUBLIC_PLAYLISTS[0].url,
};

export const LoginScreen = (props: LoginScreenProps) => {
  const { onLoginSuccess } = props;
  const [mode, setMode] = useState<'profiles' | 'login'>('profiles');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<Source>('xtream');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  React.useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('get-profiles');
      if (result.success) {
        setProfiles(result.data || []);
        if ((result.data || []).length === 0) {
          setMode('login');
        }
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.profileName.trim()) {
      setError('Profile name is required');
      return false;
    }
    if (source === 'xtream') {
      if (!formData.serverUrl.trim()) {
        setError('Server URL is required');
        return false;
      }
      if (!formData.username.trim()) {
        setError('Username is required');
        return false;
      }
      if (!formData.password) {
        setError('Password is required');
        return false;
      }
    } else if (source === 'private' && !formData.m3uUrl.trim()) {
      setError('Playlist URL or file path is required');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      if (source !== 'xtream') {
        const playlistUrl = (source === 'public' ? formData.publicUrl : formData.m3uUrl).trim();
        const profile = {
          id: `profile-${Date.now()}`,
          name: formData.profileName,
          serverUrl: playlistUrl,
          username: M3U_USER,
          password: 'm3u',
          m3uUrl: playlistUrl,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };

        // Download and parse now so a bad link is reported here instead of on an empty screen
        const result = await window.electron.ipcRenderer.invoke('authenticate', {
          serverUrl: profile.serverUrl,
          username: profile.username,
          password: profile.password,
        });
        if (!result.success) {
          setError(result.error || 'Could not load that playlist');
          return;
        }

        await window.electron.ipcRenderer.invoke('save-profile', profile);
        onLoginSuccess({ ...profile, accountInfo: result.data });
      } else {
        // Xtream API login
        const result = await window.electron.ipcRenderer.invoke('authenticate', {
          serverUrl: formData.serverUrl,
          username: formData.username,
          password: formData.password,
        });

        if (!result.success) {
          setError(result.error || 'Authentication failed');
          setLoading(false);
          return;
        }

        const profileId = `profile-${Date.now()}`;
        const profile = {
          id: profileId,
          name: formData.profileName,
          serverUrl: formData.serverUrl,
          username: formData.username,
          password: formData.password,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };

        await window.electron.ipcRenderer.invoke('save-profile', profile);

        onLoginSuccess({
          ...profile,
          accountInfo: result.data,
        });
      }
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profile: any) => {
    if (!window.confirm(`Remove profile "${profile.name}"?`)) return;
    await window.electron.ipcRenderer.invoke('delete-profile', profile.id);
    const remaining = profiles.filter((p) => p.id !== profile.id);
    setProfiles(remaining);
    if (remaining.length === 0) setMode('login');
  };

  const handleQuickLogin = async (profile: any) => {
    setLoading(true);
    setError('');

    try {
      const result = await window.electron.ipcRenderer.invoke('authenticate', {
        serverUrl: profile.serverUrl,
        username: profile.username,
        password: profile.password,
      });

      if (!result.success) {
        setError('Re-authentication failed: ' + (result.error || 'Unknown error'));
        setLoading(false);
        return;
      }

      await window.electron.ipcRenderer.invoke('save-profile', {
        ...profile,
        lastUsed: Date.now(),
      });

      onLoginSuccess({
        ...profile,
        accountInfo: result.data,
      });
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Login failed'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 animate-slide-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="KnackeredTV" className="w-32 h-32 object-contain mb-3" />
          <h1 className="text-4xl font-bold gradient-text mb-2">KnackeredTV</h1>
          <p className="text-white/60">Modern IPTV Player for Windows</p>
        </div>

        {mode === 'profiles' && profiles.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Select Profile</h2>
            <div className="space-y-3 mb-6">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex gap-2">
                  <button
                    onClick={() => handleQuickLogin(profile)}
                    disabled={loading}
                    className="flex-1 min-w-0 glass-card p-4 text-left hover:bg-white/15 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium truncate">{profile.name}</div>
                    <div className="text-sm text-white/50 truncate">
                      {isM3uProfile(profile) ? 'M3U playlist' : profile.username}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(profile)}
                    disabled={loading}
                    title="Remove this profile"
                    className="glass-card px-3 text-white/50 hover:text-red-300 hover:bg-red-500/10 transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setMode('login');
                setSource('xtream');
                setFormData(EMPTY_FORM);
                setError('');
              }}
              className="w-full glass-button mb-3"
            >
              Add New Profile
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-6">
              {mode === 'login' ? 'Add New Profile' : 'Select Profile'}
            </h2>

            <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm mb-5">
              {([
                ['xtream', 'Xtream login'],
                ['public', 'Public playlist'],
                ['private', 'My playlist'],
              ] as [Source, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSource(key);
                    setError('');
                  }}
                  className={`flex-1 py-2 ${source === key ? 'bg-blue-500/40 text-white' : 'text-white/60 hover:bg-white/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Profile Name</label>
                <input
                  type="text"
                  name="profileName"
                  value={formData.profileName}
                  onChange={handleInputChange}
                  placeholder="My IPTV Profile"
                  className="w-full"
                />
              </div>

              {source === 'xtream' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Server URL</label>
                    <input
                      type="url"
                      name="serverUrl"
                      value={formData.serverUrl}
                      onChange={handleInputChange}
                      placeholder="https://example.com:8080"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Username</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="username"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {source === 'public' && (
                <div>
                  <label className="block text-sm font-medium mb-2">iptv-org free channels</label>
                  <select
                    name="publicUrl"
                    value={formData.publicUrl}
                    onChange={handleInputChange}
                    className="w-full"
                  >
                    {PUBLIC_PLAYLISTS.map((p) => (
                      <option key={p.url} value={p.url} className="bg-slate-900">
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-2">
                    Free, publicly available channels from the iptv-org project. Some streams may be offline or
                    geo-blocked.
                  </p>
                </div>
              )}

              {source === 'private' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Playlist URL or file path</label>
                  <input
                    type="text"
                    name="m3uUrl"
                    value={formData.m3uUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/playlist.m3u or C:\playlists\mine.m3u"
                    className="w-full"
                  />
                  <p className="text-xs text-white/40 mt-2">
                    Stored only on this PC. Links that contain a login or token are never written to the log.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className={`w-full glass-button font-semibold py-3 mb-3 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Connecting...' : source === 'xtream' ? 'Login' : 'Load playlist'}
            </button>

            {profiles.length > 0 && (
              <button
                onClick={() => {
                  setMode('profiles');
                  setFormData(EMPTY_FORM);
                  setError('');
                }}
                className="w-full text-sm text-white/60 hover:text-white/80 transition-colors"
              >
                ← Back to Profiles
              </button>
            )}
          </>
        )}

        <div className="mt-8 pt-8 border-t border-white/10 text-center text-xs text-white/40">
          <p>Xtream Codes API & M3U compatible</p>
        </div>
      </div>
    </div>
  );
};
