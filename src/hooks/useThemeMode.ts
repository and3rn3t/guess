// Theme mode cycler — extracted from App.tsx (RF.4).
// Cycles dark → light → system on each call.

import { useTheme } from "next-themes";
import { useCallback } from "react";

const THEME_ORDER = ["dark", "light", "system"] as const;

export function useThemeMode(): {
  theme: string | undefined;
  toggleTheme: () => void;
} {
  const { theme, setTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(
      (theme as (typeof THEME_ORDER)[number]) ?? "dark",
    );
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }, [theme, setTheme]);
  return { theme, toggleTheme };
}
