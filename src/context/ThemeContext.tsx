"use client";

import React, { createContext, useContext, useLayoutEffect } from "react";

type Theme = "dark";

interface ThemeContextType {
  theme: Theme;
  // Remove toggleTheme as we only support dark mode
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Always return dark theme
function getInitialTheme(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: Theme = "dark";

  useLayoutEffect(() => {
    // Always apply dark mode
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
