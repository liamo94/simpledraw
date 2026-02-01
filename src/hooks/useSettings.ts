import { useState, useCallback } from "react";

export type Settings = {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showZoomControls: boolean;
  showDotGrid: boolean;
  theme: "system" | "dark" | "light";
  confirmClear: boolean;
};

const STORAGE_KEY = "blackboard-settings";

const defaults: Settings = {
  lineWidth: 5,
  lineColor: "#ffffff",
  dashGap: 5,
  showZoomControls: false,
  showDotGrid: false,
  theme: "system",
  confirmClear: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
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
