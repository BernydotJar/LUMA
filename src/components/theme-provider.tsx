"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  defaultLumaTheme,
  isLumaTheme,
  LUMA_THEME_STORAGE_KEY,
  type LumaThemeId,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: LumaThemeId;
  setTheme: (theme: LumaThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LUMA_THEME_CHANGE_EVENT = "luma-theme-change";

function readBrowserTheme(): LumaThemeId {
  const htmlTheme = document.documentElement.dataset.theme;
  if (isLumaTheme(htmlTheme)) return htmlTheme;

  try {
    const stored = window.localStorage.getItem(LUMA_THEME_STORAGE_KEY);
    if (isLumaTheme(stored)) return stored;
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }

  return defaultLumaTheme;
}

function subscribeToTheme(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LUMA_THEME_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(LUMA_THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LUMA_THEME_CHANGE_EVENT, callback);
  };
}

function getThemeSnapshot(): LumaThemeId {
  return readBrowserTheme();
}

function getServerThemeSnapshot(): LumaThemeId {
  return defaultLumaTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const setTheme = useCallback((nextTheme: LumaThemeId) => {
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(LUMA_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still applies for the current page when storage is blocked.
    }
    window.dispatchEvent(new Event(LUMA_THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLumaTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useLumaTheme must be used inside ThemeProvider");
  return value;
}
