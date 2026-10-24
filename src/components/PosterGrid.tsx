import React, { useEffect, useRef, useState } from 'react';

interface PosterGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T) => React.ReactNode;
}

const PAGE_SIZE = 60;

// Categories can hold thousands of titles, so cards are rendered in pages as the user scrolls
export function PosterGrid<T>({ items, getKey, render }: PosterGridProps<T>) {
  const [count, setCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(PAGE_SIZE), [items]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setCount((c) => Math.min(c + PAGE_SIZE, items.length));
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, count]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {items.slice(0, count).map((item) => (
          <React.Fragment key={getKey(item)}>{render(item)}</React.Fragment>
        ))}
      </div>
      {count < items.length && <div ref={sentinelRef} className="h-10" />}
    </>
  );
}
