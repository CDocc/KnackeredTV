import React, { useEffect, useRef, useState } from 'react';

interface PinModalProps {
  title?: string;
  // Return null when the PIN is accepted, otherwise the error to show
  onSubmit: (pin: string) => Promise<string | null>;
  onCancel: () => void;
}

export const PinModal = ({ title = 'Enter PIN', onSubmit, onCancel }: PinModalProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    const result = await onSubmit(pin);
    setBusy(false);
    if (result) {
      setError(result);
      setPin('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="glass-panel w-full max-w-xs p-6 rounded-xl border border-white/10 text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full text-center tracking-[0.6em] text-2xl bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
          placeholder="••••"
        />
        <div className="h-5 mt-2 text-sm text-red-300">{error}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={onCancel} className="glass-button flex-1 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pin.length < 4 || busy}
            className="flex-1 py-2 text-sm rounded-lg bg-blue-500/50 hover:bg-blue-500/70 text-white disabled:opacity-40"
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
};
