import { useEffect } from 'react';
import type { Theme } from '@shared/schemas/settings';

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Keeps the `dark` class on <html> in step with the chosen theme, including OS changes. */
export function useApplyTheme(theme: Theme | undefined): void {
  useEffect(() => {
    if (!theme) return;
    const apply = () =>
      document.documentElement.classList.toggle('dark', resolve(theme) === 'dark');
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
