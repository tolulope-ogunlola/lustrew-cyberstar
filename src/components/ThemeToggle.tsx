"use client";

import { useEffect, useState } from "react";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { Icon } from "./icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Read the actual class set by the no-FOUC script after hydration.
  useEffect(() => {
    setThemeState(getTheme());
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleTheme())}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-ink-800 hover:text-slate-200 ${className}`}
    >
      {/* Avoid an icon flash before we know the resolved theme. */}
      {mounted && <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" />}
    </button>
  );
}
