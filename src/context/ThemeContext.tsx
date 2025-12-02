"use client";

import React, { createContext, useContext, useLayoutEffect } from "react";

const ThemeContext = createContext<{ theme: "dark" } | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    // Always apply dark mode
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark" }}>
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
