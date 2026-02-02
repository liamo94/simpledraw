import { useCallback, useState, useEffect, useRef, ReactNode } from "react";
import Canvas from "./components/Canvas";
import type { TouchTool } from "./components/Canvas";
import Menu from "./components/Menu";
import useSettings from "./hooks/useSettings";

const isMac = navigator.platform.toUpperCase().includes("MAC");

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [settings, updateSettings] = useSettings();

  const [zoom, setZoom] = useState(1);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(
    getSystemTheme,
  );
  const [touchTool, setTouchTool] = useState<TouchTool>("draw");
  const [hasTouch, setHasTouch] = useState(false);

  const resolvedTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Detect touch device
  useEffect(() => {
    const onTouch = () => {
      setHasTouch(true);
      window.removeEventListener("touchstart", onTouch);
    };
    window.addEventListener("touchstart", onTouch);
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  // Listen for OS theme changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Apply body styles based on resolved theme
  useEffect(() => {
    if (resolvedTheme === "dark") {
      document.body.style.background = "#0a0a1a";
      document.body.style.color = "rgba(255,255,255,0.8)";
    } else {
      document.body.style.background = "#f5f5f0";
      document.body.style.color = "rgba(0,0,0,0.8)";
    }
  }, [resolvedTheme]);

  // Swap default line color when theme changes
  const prevThemeRef = useRef(resolvedTheme);
  useEffect(() => {
    if (prevThemeRef.current === resolvedTheme) return;
    const prev = prevThemeRef.current;
    prevThemeRef.current = resolvedTheme;
    const color = settingsRef.current.lineColor;
    if (resolvedTheme === "light" && prev === "dark" && color === "#ffffff") {
      updateSettings({ lineColor: "#000000" });
    } else if (
      resolvedTheme === "dark" &&
      prev === "light" &&
      color === "#000000"
    ) {
      updateSettings({ lineColor: "#ffffff" });
    }
  }, [resolvedTheme, updateSettings]);

  const [confirmingClear, setConfirmingClear] = useState(false);

  const doClear = useCallback(() => {
    setConfirmingClear(false);
    window.dispatchEvent(new Event("blackboard:clear"));
  }, []);

  const requestClear = useCallback(() => {
    if (settingsRef.current.confirmClear) {
      const detail = { count: 0 };
      window.dispatchEvent(
        new CustomEvent("blackboard:query-stroke-count", { detail }),
      );
      if (detail.count > 16) {
        setConfirmingClear(true);
        return;
      }
    }
    doClear();
  }, [doClear]);

  useEffect(() => {
    const onZoom = (e: Event) => setZoom((e as CustomEvent).detail);
    const onThickness = (e: Event) => {
      const delta = (e as CustomEvent).detail as number;
      const cur = settingsRef.current.lineWidth;
      updateSettings({ lineWidth: Math.min(8, Math.max(1, cur + delta)) });
    };
    const onRequestClear = () => requestClear();
    window.addEventListener("blackboard:zoom", onZoom);
    window.addEventListener("blackboard:thickness", onThickness);
    window.addEventListener("blackboard:request-clear", onRequestClear);
    return () => {
      window.removeEventListener("blackboard:zoom", onZoom);
      window.removeEventListener("blackboard:thickness", onThickness);
      window.removeEventListener("blackboard:request-clear", onRequestClear);
    };
  }, [updateSettings, requestClear]);

  // Confirmation overlay keyboard handler — capture phase to block Canvas
  useEffect(() => {
    if (!confirmingClear) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === "Enter" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        doClear();
      } else if (e.key === "Escape") {
        setConfirmingClear(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [confirmingClear, doClear]);

  const resetView = useCallback(() => {
    window.dispatchEvent(new Event("blackboard:reset-view"));
    setZoom(1);
  }, []);

  const centerView = useCallback(() => {
    window.dispatchEvent(new Event("blackboard:center-view"));
  }, []);

  const exportPng = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "simpledraw.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  const exportTransparent = useCallback(() => {
    window.dispatchEvent(new Event("blackboard:export-transparent"));
  }, []);

  const zoomIn = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("blackboard:zoom-step", { detail: 1.25 }),
    );
  }, []);

  const zoomOut = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("blackboard:zoom-step", { detail: 0.8 }),
    );
  }, []);

  const isDark = resolvedTheme === "dark";

  const touchTools: { id: TouchTool; label: string; icon: ReactNode }[] = [
    {
      id: "hand",
      label: "Pan",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 1.5v9M5.5 3v7.5a2 2 0 0 0 2 2h3a3 3 0 0 0 3-3V5.5M5.5 3a1.25 1.25 0 1 1 2.5 0M5.5 3a1.25 1.25 0 0 0-2.5 0v5.5M3 4.5a1.25 1.25 0 0 0-2.5 0V9a5 5 0 0 0 5 5M10.5 1.5a1.25 1.25 0 1 1 2.5 0v4" />
        </svg>
      ),
    },
    {
      id: "draw",
      label: "Draw",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 14l3-1L13.5 4.5a1.4 1.4 0 0 0-2-2L3 11z" />
          <path d="M10.5 3.5l2 2" />
        </svg>
      ),
    },
    {
      id: "dashed",
      label: "Dash",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="3 3"
        >
          <line x1="2" y1="8" x2="14" y2="8" />
        </svg>
      ),
    },
    {
      id: "erase",
      label: "Erase",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 14h8" />
          <rect
            x="2"
            y="5"
            width="12"
            height="7"
            rx="1"
            transform="rotate(-20 8 8.5)"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Menu
        settings={settings}
        updateSettings={updateSettings}
        onExport={exportPng}
        onExportTransparent={exportTransparent}
        onClear={requestClear}
        zoom={zoom}
        onResetView={resetView}
        resolvedTheme={resolvedTheme}
        hasTouch={hasTouch}
      />
      <Canvas
        lineWidth={settings.lineWidth}
        lineColor={settings.lineColor}
        dashGap={settings.dashGap}
        showDotGrid={settings.showDotGrid}
        resolvedTheme={resolvedTheme}
        touchTool={touchTool}
      />
      {settings.showZoomControls && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5">
          <button
            onClick={centerView}
            title={`Fit to content (${isMac ? "\u2318" : "Ctrl"}+1)`}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M5 2.5v3h-3M11 2.5v3h3M5 13.5v-3h-3M11 13.5v-3h3" />
            </svg>
          </button>
          <button
            onClick={zoomOut}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-colors text-sm font-mono ${isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
          >
            -
          </button>
          <span
            className={`text-xs tabular-nums w-10 text-center ${isDark ? "text-white/50" : "text-black/50"}`}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-colors text-sm font-mono ${isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
          >
            +
          </button>
        </div>
      )}
      {hasTouch && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-lg border backdrop-blur-sm"
          style={{
            background: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
            borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          }}
        >
          {touchTools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTouchTool(t.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded text-xs transition-colors ${
                touchTool === t.id
                  ? isDark
                    ? "bg-white/20 text-white"
                    : "bg-black/20 text-black"
                  : isDark
                    ? "text-white/60 hover:bg-white/10"
                    : "text-black/60 hover:bg-black/10"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      )}
      {confirmingClear && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          onClick={() => setConfirmingClear(false)}
        >
          <div
            className={`px-6 py-4 rounded-lg border backdrop-blur-sm text-center ${isDark ? "bg-black/80 border-white/15" : "bg-white/80 border-black/15"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`text-sm font-medium ${isDark ? "text-white/90" : "text-black/90"}`}
            >
              Clear all strokes?
            </div>
            <div
              className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-black/50"}`}
            >
              Enter or {isMac ? "\u2318" : "Ctrl"}+K to confirm &middot; Esc to
              cancel
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setConfirmingClear(false)}
                className={`flex-1 py-1.5 rounded text-xs transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
              >
                Cancel
              </button>
              <button
                onClick={doClear}
                className={`flex-1 py-1.5 rounded text-xs transition-colors ${isDark ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20" : "text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20"}`}
              >
                Clear ({isMac ? "\u2318" : "Ctrl"}+K)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
