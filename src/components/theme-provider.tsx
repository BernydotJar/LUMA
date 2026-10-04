"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

function readInitialTheme(): LumaThemeId {
  if (typeof document === "undefined") return defaultLumaTheme;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<LumaThemeId>(readInitialTheme);

  const setTheme = useCallback((nextTheme: LumaThemeId) => {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(LUMA_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still applies for the current page when storage is blocked.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLumaTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useLumaTheme must be used inside ThemeProvider");
  return value;
}
