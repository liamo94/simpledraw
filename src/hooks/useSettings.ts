import { useState, useCallback, useEffect, useRef } from "react";

export type ShapeKind =
  | "line"
  | "circle"
  | "rectangle"
  | "triangle"
  | "star"
  | "arrow"
  | "pentagon"
  | "hexagon"
  | "diamond"
  | "lightning";

export type Theme = "dark" | "midnight" | "lumber" | "white" | "journal" | "sky";

export type TextSize = "xs" | "s" | "m" | "l" | "xl";

export type Settings = {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showZoomControls: boolean;
  showDotGrid: boolean;
  theme: Theme;
  confirmClear: boolean;
  activeShape: ShapeKind;
  textSize: TextSize;
};

const STORAGE_KEY = "drawtool-settings";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "white";
}

function getDefaults(): Settings {
  return {
    lineWidth: 5,
    lineColor: "#ffffff",
    dashGap: 5,
    showZoomControls: true,
    showDotGrid: false,
    theme: getSystemTheme(),
    confirmClear: true,
    activeShape: "rectangle" as const,
    textSize: "m" as const,
  };
}

function load(): Settings {
  const defaults = getDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old "system" or "light" theme values
      if (parsed.theme === "system") {
        parsed.theme = getSystemTheme();
      } else if (parsed.theme === "light") {
        parsed.theme = "white";
      }
      return { ...defaults, ...parsed };
    }
  } catch {
    /* ignore bad data */
  }
  return defaults;
}

export default function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  const pendingRef = useRef<Settings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRef.current));
      } catch {
        /* ignore */
      }
      pendingRef.current = null;
    }
  }, []);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current) {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(pendingRef.current),
            );
          } catch {
            /* ignore */
          }
          pendingRef.current = null;
        }
      }, 300);
      return next;
    });
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRef.current));
        } catch {
          /* ignore */
        }
        pendingRef.current = null;
      }
    };
  }, []);

  // Flush on beforeunload
  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  return [settings, updateSettings] as const;
}
