import React, { useState } from 'react';
import { FavoriteKind } from './FavoritesContext';
import { useParental } from './ParentalContext';

const ADULT = /adult|xxx|18\+|porn|erotic/i;
const CATEGORY_CHANNELS: Record<FavoriteKind, string> = {
  live: 'get-live-categories',
  movie: 'get-movie-categories',
  series: 'get-series-categories',
};

const field =
  'bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white w-40 focus:outline-none focus:border-blue-400/50';

export const ParentalSettings = ({ profile }: { profile: any }) => {
  const { hasPin, locked, setPin, removePin, lockCategories } = useParental();
  const [mode, setMode] = useState<'set' | 'change' | 'remove' | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState('');

  const digits = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value.replace(/\D/g, ''));

  const close = () => {
    setMode(null);
    setCurrentPin('');
    setNewPin('');
  };

  const submit = async () => {
    const result =
      mode === 'remove' ? await removePin(currentPin) : await setPin(newPin, hasPin ? currentPin : undefined);
    if (!result.success) {
      setMessage(result.error || 'Something went wrong');
      return;
    }
    setMessage(mode === 'remove' ? 'PIN removed' : 'PIN saved');
    close();
  };

  const autoLockAdult = async () => {
    const creds = { serverUrl: profile.serverUrl, username: profile.username, password: profile.password };
    let count = 0;
    for (const kind of Object.keys(CATEGORY_CHANNELS) as FavoriteKind[]) {
      const result = await window.electron.ipcRenderer.invoke(CATEGORY_CHANNELS[kind], creds);
      const ids = ((result.success && result.data) || [])
        .filter((c: any) => ADULT.test(String(c.category_name)))
        .map((c: any) => String(c.category_id));
      count += ids.filter((id: string) => !locked[kind].includes(id)).length;
      if (ids.length) await lockCategories(kind, ids);
    }
    setMessage(count ? `Locked ${count} adult categories` : 'No new adult categories found');
  };

  const lockedCount = locked.live.length + locked.movie.length + locked.series.length;
  const needsNew = mode === 'set' || mode === 'change';
  const ready = (needsNew ? newPin.length >= 4 : true) && (hasPin ? currentPin.length >= 4 : true);

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-white">Parental Controls</h2>
      <div className="glass-card p-4 rounded-lg border border-white/10">
        <p className="text-sm text-white/70 mb-3">
          {hasPin
            ? `PIN is set. ${lockedCount} categories locked. Use the 🔓 button in the sidebar, then the 🔒 buttons beside categories, to choose what to lock.`
            : 'Set a 4 to 8 digit PIN to lock categories (for example adult content).'}
        </p>

        {!mode && (
          <div className="flex flex-wrap gap-2">
            {!hasPin && (
              <button onClick={() => setMode('set')} className="glass-button px-4 py-2 text-sm">
                Set PIN…
              </button>
            )}
            {hasPin && (
              <>
                <button onClick={() => setMode('change')} className="glass-button px-4 py-2 text-sm">
                  Change PIN…
                </button>
                <button onClick={() => setMode('remove')} className="glass-button px-4 py-2 text-sm">
                  Remove PIN…
                </button>
                <button onClick={autoLockAdult} className="glass-button px-4 py-2 text-sm">
                  Auto-lock adult categories
                </button>
              </>
            )}
          </div>
        )}

        {mode && (
          <div className="flex flex-wrap items-center gap-2">
            {hasPin && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="Current PIN"
                value={currentPin}
                onChange={digits(setCurrentPin)}
                className={field}
              />
            )}
            {needsNew && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="New PIN"
                value={newPin}
                onChange={digits(setNewPin)}
                className={field}
              />
            )}
            <button
              onClick={submit}
              disabled={!ready}
              className="px-4 py-2 text-sm rounded-lg bg-blue-500/50 hover:bg-blue-500/70 text-white disabled:opacity-40"
            >
              {mode === 'remove' ? 'Remove' : 'Save'}
            </button>
            <button onClick={close} className="glass-button px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        )}

        {message && <p className="text-sm text-blue-200 mt-2">{message}</p>}
        <p className="text-xs text-white/40 mt-2">
          This keeps casual viewers out of locked categories. It is not a hard security boundary.
        </p>
      </div>
    </div>
  );
};
