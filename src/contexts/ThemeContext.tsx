"use client";

import { createContext, useContext } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark mode is currently disabled. The provider still exists so that
  // components calling `useTheme` continue to work without changes.
  // To re-enable: restore the previous useState/useEffect/toggle logic
  // and re-add the toggle button on the settings page.
  const value: ThemeContextType = {
    theme: "light",
    toggleTheme: () => {
      // No-op while dark mode is disabled.
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}