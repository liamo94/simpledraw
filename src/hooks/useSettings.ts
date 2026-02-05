import { useState, useCallback } from "react";

export type ShapeKind = "circle" | "rectangle" | "triangle" | "star" | "arrow" | "pentagon" | "hexagon" | "octagon" | "diamond";

export type Theme = "dark" | "midnight" | "white";

export type Settings = {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showZoomControls: boolean;
  showDotGrid: boolean;
  theme: Theme;
  confirmClear: boolean;
  activeShape: ShapeKind;
};

const STORAGE_KEY = "simpledraw-settings";

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
    showDotGrid: true,
    theme: getSystemTheme(),
    confirmClear: true,
    activeShape: "rectangle" as const,
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

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, updateSettings] as const;
}
