import { useEffect } from 'react';

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  preventDefault?: boolean;
};

export function useKeyboard(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const ctrl = s.ctrl || s.meta || false;
        const matchCtrl = s.ctrl ? e.ctrlKey : s.meta ? e.metaKey : true;
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          matchCtrl === ctrl &&
          (s.shift ? e.shiftKey : true)
        ) {
          if (s.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          s.handler();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
