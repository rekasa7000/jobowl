import type { ReactNode } from 'react';

export function ScreenHeader({
  title,
  aside,
  actions,
}: {
  title: string;
  aside?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b-[1.5px] border-line px-8 py-5">
      <div className="flex items-baseline gap-4">
        <h1 className="font-display-caps text-[3.5rem]">{title}</h1>
        {aside && <span className="font-accent text-lg italic text-ink-2">{aside}</span>}
      </div>
      {actions}
    </header>
  );
}
