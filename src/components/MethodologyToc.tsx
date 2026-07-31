'use client';
import { useEffect, useState } from 'react';

export type TocItem = { id: string; label: string };

// Sticky left-rail jump menu for the methodology page — desktop only (rendered conditionally by
// the page via md:block). Highlights whichever section is currently in view using the same
// IntersectionObserver approach as LeaderboardTable's highlight-row tracking, rather than a
// scroll-position calculation, so it stays correct regardless of section height.
export default function MethodologyToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const targets = items
      .map(item => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    // Tracks every section's visibility and picks the topmost one still on screen, rather than
    // reacting to a single section's enter/exit — with many short sections, two can be
    // intersecting at once, and "topmost visible" is what a reader would call "where I am."
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const topmost = items.find(item => visible.has(item.id));
        if (topmost) setActiveId(topmost.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 }
    );
    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto text-sm">
      <p className="font-medium text-foreground mb-2">On this page</p>
      <ul className="space-y-1 border-l">
        {items.map(item => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={[
                  'block pl-3 -ml-px border-l py-1 transition-colors',
                  isActive
                    ? 'border-l-primary text-primary font-medium'
                    : 'border-l-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
