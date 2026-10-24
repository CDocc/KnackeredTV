import React, { useState } from 'react';
import logo from '../../assets/kntvlogo.png';

interface LoginScreenProps {
  onLoginSuccess: (profile: any) => void;
}

export const LoginScreen = (props: LoginScreenProps) => {
  const { onLoginSuccess } = props;
  const [mode, setMode] = useState<'profiles' | 'login'>('profiles');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    profileName: '',
    serverUrl: '',
    username: '',
    password: '',
    useM3u: false,
    m3uUrl: '',
  });
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
    if (!formData.serverUrl.trim()) {
      setError('Server URL is required');
      return false;
    }
    if (formData.useM3u) {
      if (!formData.m3uUrl.trim()) {
        setError('M3U URL is required');
        return false;
      }
    } else {
      if (!formData.username.trim()) {
        setError('Username is required');
        return false;
      }
      if (!formData.password) {
        setError('Password is required');
        return false;
      }
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      if (formData.useM3u) {
        // M3U URL login - just save the profile
        const profileId = `profile-${Date.now()}`;
        const profile = {
          id: profileId,
          name: formData.profileName,
          serverUrl: formData.serverUrl,
          username: 'm3u-user',
          password: 'm3u-pass',
          m3uUrl: formData.m3uUrl,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };

        await window.electron.ipcRenderer.invoke('save-profile', profile);
        onLoginSuccess(profile);
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
                <button
                  key={profile.id}
                  onClick={() => handleQuickLogin(profile)}
                  disabled={loading}
                  className="w-full glass-card p-4 text-left hover:bg-white/15 transition-all 
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium">{profile.name}</div>
                  <div className="text-sm text-white/50">{profile.username}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMode('login');
                setFormData({
                  profileName: '',
                  serverUrl: '',
                  username: '',
                  password: '',
                  useM3u: false,
                  m3uUrl: '',
                });
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

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="useM3u"
                  name="useM3u"
                  checked={formData.useM3u}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="useM3u" className="text-sm">
                  Use M3U URL instead
                </label>
              </div>

              {formData.useM3u ? (
                <div>
                  <label className="block text-sm font-medium mb-2">M3U URL</label>
                  <input
                    type="url"
                    name="m3uUrl"
                    value={formData.m3uUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/playlist.m3u"
                    className="w-full"
                  />
                </div>
              ) : (
                <>
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
              {loading ? 'Connecting...' : 'Login'}
            </button>

            {profiles.length > 0 && (
              <button
                onClick={() => {
                  setMode('profiles');
                  setFormData({
                    profileName: '',
                    serverUrl: '',
                    username: '',
                    password: '',
                    useM3u: false,
                    m3uUrl: '',
                  });
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
