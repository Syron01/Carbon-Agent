import type { ReactNode } from 'react';
import { IconSearch, IconSun, IconMoon } from '@tabler/icons-react';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';

interface Props {
  onOpenPalette: () => void;
  /** The dock pill, rendered inline at the top centre. */
  center?: ReactNode;
}

export function TopRibbon({ onOpenPalette, center }: Props) {
  const { settings, setTheme } = useApp();
  const theme = settings?.theme ?? 'dark';

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="top-ribbon">
      <div className="top-ribbon-inner">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 shrink-0 bg-transparent border-none cursor-pointer text-[var(--fg-default)]"
          title="Command palette"
        >
          <Logo size={18} />
          <span className="text-[13px] font-semibold tracking-tight">Astro</span>
        </button>

        <div className="top-ribbon-center">
          {center}
          <button onClick={onOpenPalette} className="top-search-btn" title="Search, jump to, or run a command (⌘K)">
            <IconSearch size={16} stroke={1.7} />
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={toggleTheme} className="composer-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'}`}>
            {theme === 'dark' ? <IconSun size={16} stroke={1.6} /> : <IconMoon size={16} stroke={1.6} />}
          </button>
        </div>
      </div>
    </header>
  );
}
