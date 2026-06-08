import { useEffect, useCallback } from 'react';

export type ModKey = 'metaKey' | 'ctrlKey';

interface Shortcut {
  key: string;
  mod?: ModKey;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[];
  element?: HTMLElement | null;
}

function matchMod(e: KeyboardEvent, mod?: ModKey): boolean {
  if (!mod) return !e.metaKey && !e.ctrlKey;
  return mod === 'metaKey' ? e.metaKey : e.ctrlKey;
}

export function useKeyboardShortcuts({ shortcuts, element }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: Event) => {
      const ke = e as KeyboardEvent;
      for (const s of shortcuts) {
        if (s.enabled === false) continue;
        if (
          ke.key.toLowerCase() === s.key.toLowerCase() &&
          matchMod(ke, s.mod) &&
          !!ke.shiftKey === !!s.shift &&
          !!ke.altKey === !!s.alt
        ) {
          ke.preventDefault();
          ke.stopPropagation();
          s.handler();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    const target = element || document;
    target.addEventListener('keydown', handleKeyDown);
    return () => target.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, element]);
}
