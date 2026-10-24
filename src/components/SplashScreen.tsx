import React, { useEffect, useState } from 'react';
import logo from '../../assets/kntvlogo.png';

// Brief branded intro on launch; fades out on its own (click to skip)
export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setFading(true), 1800);
    const done = setTimeout(onDone, 2400);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-600 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: '600ms' }}
    >
      <img src={logo} alt="KnackeredTV" className="w-64 h-64 object-contain animate-pulse" />
      <div className="mt-6 w-40 h-1 rounded bg-white/10 overflow-hidden">
        <div className="h-full bg-blue-400" style={{ animation: 'splash-bar 1.8s ease-out forwards' }} />
      </div>
      <style>{`@keyframes splash-bar { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
};
