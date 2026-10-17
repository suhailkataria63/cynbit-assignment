"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeTheme, THEME_KEY } from "@/lib/theme/preference";

const changeEvent = "cynbit:theme-change";
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
function subscribe(notify: () => void) {
  const syncStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      document.documentElement.dataset.theme = normalizeTheme(event.newValue);
      notify();
    }
  };
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", syncStorage);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", syncStorage);
  };
}
const snapshot = () => normalizeTheme(document.documentElement.dataset.theme ?? null);
const serverSnapshot = () => "light" as const;

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  function toggle() {
    const root = document.documentElement;
    const next = snapshot() === "light" ? "dark" : "light";
    clearTimeout(transitionTimer);
    root.dataset.themeTransition = "true";
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Theme still works when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent));
    transitionTimer = setTimeout(() => { delete root.dataset.themeTransition; }, 500);
  }
  return <Button variant="secondary" size="sm" className="theme-toggle relative size-11 shrink-0 p-0" onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
    <span className="theme-icon theme-sun" aria-hidden="true"><Sun /></span>
    <span className="theme-icon theme-moon" aria-hidden="true"><Moon /></span>
  </Button>;
}
