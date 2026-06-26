// Client-side theme helpers. The initial class is set by the inline script in layout.tsx (no FOUC);
// these manage explicit user toggles and persistence.

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
