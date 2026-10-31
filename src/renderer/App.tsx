import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Channel } from '../types';
import { LoginScreen } from '../components/LoginScreen';
import { LivePlayerHost } from '../components/LivePlayerHost';
import { LivePlayerContext, LivePlayerApi, LiveSession, LivePlayerMode, MediaSession } from '../components/LivePlayerContext';
import { LiveTV } from '../pages/LiveTV';
import { Movies } from '../pages/Movies';
import { Series } from '../pages/Series';
import { Settings } from '../pages/Settings';
import { Favorites } from '../pages/Favorites';
import { Recordings } from '../pages/Recordings';
import { Search } from '../pages/Search';
import { MultiView } from '../pages/MultiView';
import { SplashScreen } from '../components/SplashScreen';
import logo from '../../assets/kntvlogo.png';
import { FavoritesContext, FavoritesApi, FavoriteKind, FavoriteRow } from '../components/FavoritesContext';
import { ParentalContext, ParentalApi } from '../components/ParentalContext';
import { PinModal } from '../components/PinModal';
import { isM3uProfile } from '../utils/profileKind';
import './styles.css';

type PageType = 'livetv' | 'multiview' | 'movies' | 'series' | 'favorites' | 'recordings' | 'search' | 'settings';

interface CurrentProfile {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  accountInfo?: any;
}

export const App = () => {
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('livetv');
  const [searchQuery, setSearchQuery] = useState('');
  const [live, setLive] = useState<LiveSession | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [media, setMedia] = useState<MediaSession | null>(null);
  const zapListRef = useRef<Channel[]>([]);
  const previousRef = useRef<Channel | null>(null);
  const liveRef = useRef<LiveSession | null>(null);
  liveRef.current = live;
  const currentPageRef = useRef<PageType>('livetv');
  currentPageRef.current = currentPage;
  const [favoriteRows, setFavoriteRows] = useState<FavoriteRow[]>([]);
  // Item chosen on the Favorites page; the target page opens it directly
  const [openItem, setOpenItem] = useState<any>(null);

  const profileId = currentProfile?.id;
  useEffect(() => {
    if (!profileId) {
      setFavoriteRows([]);
      return;
    }
    window.electron.ipcRenderer.invoke('get-favorites', { profileId }).then((result: any) => {
      if (result.success) setFavoriteRows(result.data);
    });
  }, [profileId]);

  const favoritesApi = useMemo<FavoritesApi>(
    () => ({
      favorites: favoriteRows,
      isFavorite: (kind, id) => favoriteRows.some((f) => f.kind === kind && f.itemId === String(id)),
      toggle: (kind, id, data) => {
        if (!profileId) return;
        const itemId = String(id);
        // Update instantly; the database call only confirms
        setFavoriteRows((rows) =>
          rows.some((f) => f.kind === kind && f.itemId === itemId)
            ? rows.filter((f) => !(f.kind === kind && f.itemId === itemId))
            : [{ kind, itemId, data, addedAt: Date.now() }, ...rows]
        );
        window.electron.ipcRenderer.invoke('toggle-favorite', { profileId, kind, itemId, data });
      },
    }),
    [favoriteRows, profileId]
  );

  // ---- Parental controls ----
  const [parentalState, setParentalState] = useState<{ hasPin: boolean; locked: Record<FavoriteKind, string[]> }>({
    hasPin: false,
    locked: { live: [], movie: [], series: [] },
  });
  const [unlocked, setUnlocked] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setUnlocked(false);
    if (!profileId) {
      setParentalState({ hasPin: false, locked: { live: [], movie: [], series: [] } });
      return;
    }
    window.electron.ipcRenderer.invoke('parental-get', { profileId }).then((state: any) => {
      if (state) setParentalState({ hasPin: !!state.hasPin, locked: state.locked });
    });
  }, [profileId]);

  const parentalApi = useMemo<ParentalApi>(() => {
    const ipc = window.electron.ipcRenderer;
    const applyResult = (result: any) => {
      if (result?.success && result.data) {
        setParentalState({ hasPin: !!result.data.hasPin, locked: result.data.locked });
        if (!result.data.hasPin) setUnlocked(false);
      }
      return { success: !!result?.success, error: result?.error as string | undefined };
    };
    const isCategoryLocked = (kind: FavoriteKind, categoryId: unknown) =>
      categoryId != null && parentalState.locked[kind].includes(String(categoryId));
    const saveLocked = async (kind: FavoriteKind, ids: string[]) => {
      applyResult(await ipc.invoke('parental-set-locked', { profileId, kind, categoryIds: ids }));
    };
    return {
      hasPin: parentalState.hasPin,
      unlocked,
      locked: parentalState.locked,
      isCategoryLocked,
      isRestricted: (kind, categoryId) => parentalState.hasPin && !unlocked && isCategoryLocked(kind, categoryId),
      requestUnlock: () =>
        !parentalState.hasPin || unlocked ? Promise.resolve(true) : new Promise<boolean>((resolve) => setPinPrompt(() => resolve)),
      lockNow: () => setUnlocked(false),
      toggleCategoryLock: async (kind, categoryId) => {
        const id = String(categoryId);
        const current = parentalState.locked[kind];
        await saveLocked(kind, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
      },
      lockCategories: async (kind, ids) => {
        await saveLocked(kind, Array.from(new Set([...parentalState.locked[kind], ...ids.map(String)])));
      },
      setPin: async (pin, currentPin) => applyResult(await ipc.invoke('parental-set-pin', { profileId, pin, currentPin })),
      removePin: async (pin) => applyResult(await ipc.invoke('parental-remove-pin', { profileId, pin })),
    };
  }, [parentalState, unlocked, profileId]);

  const submitPin = async (pin: string) => {
    const result = await window.electron.ipcRenderer.invoke('parental-verify', { profileId, pin });
    if (!result.ok) return result.error || 'Wrong PIN';
    setUnlocked(true);
    pinPrompt?.(true);
    setPinPrompt(null);
    return null;
  };
  const cancelPin = () => {
    pinPrompt?.(false);
    setPinPrompt(null);
  };

  const openFavorite = (kind: FavoriteKind, item: any) => {
    if (kind === 'live') {
      setCurrentPage('livetv');
      setMedia(null);
      setLive({ channel: item, mode: 'full' });
    } else {
      setOpenItem(item);
      setCurrentPage(kind === 'movie' ? 'movies' : 'series');
    }
  };

  const livePlayer = useMemo<LivePlayerApi>(() => {
    // Remembers the channel being left so "last channel" can flip back to it
    const switchTo = (channel: Channel, mode?: LivePlayerMode) =>
      setLive((prev) => {
        if (prev && prev.channel.id !== channel.id) previousRef.current = prev.channel;
        return { channel, mode: mode ?? prev?.mode ?? 'preview' };
      });

    return {
      live,
      media,
      // Only one thing plays at a time: starting a recording/catch-up replaces the live stream
      playMedia: (next) => {
        setLive(null);
        setMedia(next);
      },
      stopMedia: () => setMedia(null),
      playChannel: (channel, mode) => {
        setMedia(null);
        switchTo(channel, mode);
      },
      minimize: () =>
        setLive((prev) => (prev ? { ...prev, mode: currentPageRef.current === 'livetv' ? 'preview' : 'mini' } : prev)),
      expand: () => {
        setCurrentPage('livetv');
        setLive((prev) => (prev ? { ...prev, mode: 'full' } : prev));
      },
      stop: () => setLive(null),
      setZapList: (channels) => {
        zapListRef.current = channels;
      },
      zap: (direction) => {
        const list = zapListRef.current;
        const current = liveRef.current?.channel;
        if (!current || list.length === 0) return;
        const index = list.findIndex((c) => c.id === current.id);
        const next = list[(index + direction + list.length) % list.length];
        if (next && next.id !== current.id) switchTo(next);
      },
      zapToNumber: (num) => {
        const target = zapListRef.current.find((c) => Number(c.num) === num);
        if (!target) return false;
        switchTo(target);
        return true;
      },
      lastChannel: () => {
        if (previousRef.current) switchTo(previousRef.current);
      },
    };
  }, [live, media]);

  // Leaving Live TV while the full player is up shrinks it instead of leaving it covering other pages.
  // Multi-view needs every connection, so it stops the single player instead.
  const navigate = useCallback((page: PageType) => {
    setCurrentPage(page);
    setOpenItem(null);
    if (page === 'multiview') {
      setLive(null);
      setMedia(null);
      return;
    }
    // Back on Live TV the mini player docks into the preview slot; elsewhere it floats in the corner
    setLive((prev) => {
      if (!prev || prev.mode === 'full' && page === 'livetv') return prev;
      const next = page === 'livetv' ? 'preview' : 'mini';
      return prev.mode === next ? prev : { ...prev, mode: next };
    });
  }, []);

  // Ctrl+K jumps to the search page from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        navigate('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    // Check for saved profile on startup
    const loadLastProfile = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke('get-profiles');
        if (result.success && result.data && result.data.length > 0) {
          // Auto-load last used profile
          const lastProfile = result.data[0];
          const authResult = await window.electron.ipcRenderer.invoke('authenticate', {
            serverUrl: lastProfile.serverUrl,
            username: lastProfile.username,
            password: lastProfile.password,
          });

          if (authResult.success) {
            setCurrentProfile({
              ...lastProfile,
              accountInfo: authResult.data,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load last profile:', err);
      }
    };

    loadLastProfile();
  }, []);

  const handleLoginSuccess = (profile: CurrentProfile) => {
    setCurrentProfile(profile);
    setCurrentPage('livetv');
  };

  const handleSwitchProfile = () => {
    setCurrentProfile(null);
    setLive(null);
    setMedia(null);
    setOpenItem(null);
    setSearchQuery('');
    setCurrentPage('livetv');
  };

  const handleLogout = async () => {
    if (currentProfile) {
      try {
        await window.electron.ipcRenderer.invoke(
          'delete-profile',
          currentProfile.id
        );
      } catch (err) {
        console.error('Failed to delete profile:', err);
      }
    }
    setCurrentProfile(null);
    setLive(null);
    setCurrentPage('livetv');
  };

  if (!currentProfile) {
    return (
      <>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  const isPlaylist = isM3uProfile(currentProfile);

  return (
    <LivePlayerContext.Provider value={livePlayer}>
    <FavoritesContext.Provider value={favoritesApi}>
    <ParentalContext.Provider value={parentalApi}>
    {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    {pinPrompt && <PinModal onSubmit={submitPin} onCancel={cancelPin} />}
    <div className="flex h-screen w-screen bg-gradient-to-br from-black/80 via-slate-950 to-black/90">
      {/* Sidebar Navigation */}
      <nav className="w-64 glass-panel m-4 p-5 rounded-xl flex flex-col overflow-hidden border border-white/10">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="w-10 h-10 object-contain shrink-0" />
            <h1 className="text-2xl font-bold gradient-text">KnackeredTV</h1>
          </div>
          <p className="text-xs text-white/40 mt-1 truncate">{currentProfile.name}</p>
        </div>

        {/* Account Info */}
        {currentProfile.accountInfo && (
          <div className="glass-card p-3 rounded-lg mb-6 text-sm border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Status:</span>
              <span className="text-green-400 font-medium text-xs">
                {currentProfile.accountInfo.status || 'Active'}
              </span>
            </div>
            {currentProfile.accountInfo.exp_date && (
              <div className="mt-2 text-xs text-white/50">
                Expires: {new Date(currentProfile.accountInfo.exp_date * 1000).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-2">
          {[
            { id: 'livetv' as PageType, label: 'Live TV', icon: '📺' },
            { id: 'multiview' as PageType, label: 'Multi-View', icon: '▦' },
            { id: 'movies' as PageType, label: 'Movies', icon: '🎬' },
            { id: 'series' as PageType, label: 'Series', icon: '📺' },
            { id: 'favorites' as PageType, label: 'Favorites', icon: '★' },
            { id: 'recordings' as PageType, label: 'Recordings', icon: '⏺' },
            { id: 'search' as PageType, label: 'Search', icon: '🔍' },
          ]
            .filter((item) => !(isPlaylist && (item.id === 'movies' || item.id === 'series')))
            .map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.id);
                setSearchQuery('');
              }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium flex items-center gap-3 whitespace-nowrap
                ${
                  currentPage === item.id
                    ? 'bg-gradient-to-r from-blue-500/60 to-blue-600/40 text-white border border-blue-400/50'
                    : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="my-2 border-t border-white/10"></div>

        {/* Search Bar (Global) */}
        <div className="mb-2 glass-card p-2 rounded-lg border border-white/10">
          <input
            type="text"
            placeholder="Search..."
            title="Ctrl+K to search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.code === 'Enter' && searchQuery.trim()) {
                navigate('search');
              }
            }}
            className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 
              text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50"
          />
        </div>

        {parentalApi.hasPin && (
          <button
            onClick={() => (unlocked ? parentalApi.lockNow() : parentalApi.requestUnlock())}
            className="w-full text-left px-4 py-2 mb-1 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 border border-transparent flex items-center gap-3"
            title={unlocked ? 'Re-lock restricted content' : 'Enter PIN to unlock restricted content'}
          >
            <span className="text-lg flex-shrink-0">{unlocked ? '🔓' : '🔒'}</span>
            <span className="truncate">{unlocked ? 'Lock now' : 'Locked'}</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={handleSwitchProfile}
          className="w-full text-left px-4 py-2 mb-1 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 border border-transparent flex items-center gap-3"
          title="Switch to another profile"
        >
          <span className="text-lg flex-shrink-0">👤</span>
          <span className="truncate">Switch profile</span>
        </button>
        <button
          onClick={() => navigate('settings')}
          className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium flex items-center gap-3
            ${
              currentPage === 'settings'
                ? 'bg-gradient-to-r from-blue-500/60 to-blue-600/40 text-white border border-blue-400/50'
                : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
        >
          <span className="text-lg flex-shrink-0">⚙️</span>
          <span className="truncate">Settings</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {currentPage === 'livetv' && (
          <LiveTV profile={currentProfile} />
        )}

        {currentPage === 'multiview' && (
          <MultiView
            profile={currentProfile}
            onExpand={(channel) => {
              setCurrentPage('livetv');
              livePlayer.playChannel(channel, 'full');
            }}
          />
        )}

        {currentPage === 'movies' && <Movies profile={currentProfile} initialSelected={openItem} />}

        {currentPage === 'series' && <Series profile={currentProfile} initialSelected={openItem} />}

        {currentPage === 'favorites' && <Favorites onOpen={openFavorite} />}

        {currentPage === 'recordings' && <Recordings />}

        {currentPage === 'settings' && (
          <Settings profile={currentProfile} onLogout={handleLogout} />
        )}

        {currentPage === 'search' && (
          <Search
            profile={currentProfile}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onOpen={openFavorite}
          />
        )}

        <LivePlayerHost />
      </div>
    </div>
    </ParentalContext.Provider>
    </FavoritesContext.Provider>
    </LivePlayerContext.Provider>
  );
};
