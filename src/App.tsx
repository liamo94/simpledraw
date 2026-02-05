import { useCallback, useState, useEffect, useRef, ReactNode } from "react";
import Canvas from "./components/Canvas";
import type { TouchTool } from "./components/Canvas";
import Menu from "./components/Menu";
import useSettings, { type ShapeKind } from "./hooks/useSettings";

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
  const [hasTouch] = useState(
    () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("simpledraw-onboarded"),
  );
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showThicknessPicker, setShowThicknessPicker] = useState<"draw" | "dashed" | null>(null);
  const shapeLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thicknessLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const drawButtonRef = useRef<HTMLButtonElement>(null);
  const dashedButtonRef = useRef<HTMLButtonElement>(null);

  const resolvedTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.body.style.background = "#f5f5f0";
      document.body.style.color = "rgba(0,0,0,0.8)";
      document.documentElement.style.colorScheme = "light";
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
    window.dispatchEvent(new Event("simpledraw:clear"));
  }, []);

  const requestClear = useCallback(() => {
    if (settingsRef.current.confirmClear && !hasTouch) {
      const detail = { count: 0 };
      window.dispatchEvent(
        new CustomEvent("simpledraw:query-stroke-count", { detail }),
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
    const onColorCycle = (e: Event) => {
      const dir = (e as CustomEvent).detail as number;
      const dark =
        settingsRef.current.theme === "system"
          ? getSystemTheme() === "dark"
          : settingsRef.current.theme === "dark";
      const palette = [
        dark ? "#ffffff" : "#000000",
        "#ef4444",
        "#ec4899",
        "#22c55e",
        "#3b82f6",
        "#eab308",
        "#f97316",
        "#8b5cf6",
        "#06b6d4",
        "#92400e",
        "#4b5563",
      ];
      const cur = settingsRef.current.lineColor;
      const idx = palette.indexOf(cur);
      const next =
        (idx === -1 ? 0 : idx + dir + palette.length) % palette.length;
      updateSettings({ lineColor: palette[next] });
    };
    const onRequestClear = () => requestClear();
    const onCycleShape = () => {
      const shapes: ShapeKind[] = ["rectangle", "circle", "triangle", "star"];
      const cur = settingsRef.current.activeShape;
      const idx = shapes.indexOf(cur);
      const next = (idx + 1) % shapes.length;
      updateSettings({ activeShape: shapes[next] });
    };
    window.addEventListener("simpledraw:zoom", onZoom);
    window.addEventListener("simpledraw:thickness", onThickness);
    window.addEventListener("simpledraw:color-cycle", onColorCycle);
    window.addEventListener("simpledraw:request-clear", onRequestClear);
    window.addEventListener("simpledraw:cycle-shape", onCycleShape);
    return () => {
      window.removeEventListener("simpledraw:zoom", onZoom);
      window.removeEventListener("simpledraw:thickness", onThickness);
      window.removeEventListener("simpledraw:color-cycle", onColorCycle);
      window.removeEventListener("simpledraw:request-clear", onRequestClear);
      window.removeEventListener("simpledraw:cycle-shape", onCycleShape);
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
    window.dispatchEvent(new Event("simpledraw:reset-view"));
    setZoom(1);
  }, []);

  const centerView = useCallback(() => {
    window.dispatchEvent(new Event("simpledraw:center-view"));
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
    window.dispatchEvent(new Event("simpledraw:export-transparent"));
  }, []);

  const zoomIn = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("simpledraw:zoom-step", { detail: 1.25 }),
    );
  }, []);

  const zoomOut = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("simpledraw:zoom-step", { detail: 0.8 }),
    );
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("simpledraw-onboarded", "1");
  }, []);

  useEffect(() => {
    if (!showOnboarding) return;
    const dismiss = () => dismissOnboarding();
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [showOnboarding, dismissOnboarding]);

  // Close shape picker when touching outside
  useEffect(() => {
    if (!showShapePicker) return;
    const close = () => setShowShapePicker(false);
    // Delay to avoid immediate close from the same touch that opened it
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", close, { once: true });
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
    };
  }, [showShapePicker]);

  // Close thickness picker when touching outside
  useEffect(() => {
    if (!showThicknessPicker) return;
    const close = () => setShowThicknessPicker(null);
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", close, { once: true });
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
    };
  }, [showThicknessPicker]);

  const isDark = resolvedTheme === "dark";
  const mod = isMac ? "\u2318" : "Ctrl";
  const alt = isMac ? "\u2325" : "Alt";

  const touchTools: { id: TouchTool; label: string; icon: ReactNode }[] = [
    {
      id: "hand",
      label: "Move",
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
          <path d="M8 1.5v13M1.5 8h13M3 4.5L1.5 8 3 11.5M13 4.5L14.5 8 13 11.5M4.5 3L8 1.5 11.5 3M4.5 13L8 14.5 11.5 13" />
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
          stroke={settings.lineColor}
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
          stroke={settings.lineColor}
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
        <svg width="16" height="16" viewBox="0 0 16 16">
          <defs>
            <linearGradient id="eraser-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="50%" stopColor="#89CFF0" />
              <stop offset="50%" stopColor="#FA8072" />
            </linearGradient>
          </defs>
          <rect
            x="2"
            y="4.5"
            width="12"
            height="7"
            rx="1.5"
            transform="rotate(-25 8 8)"
            fill="url(#eraser-grad)"
            stroke="#666"
            strokeWidth="1"
          />
        </svg>
      ),
    },
    {
      id: "shape",
      label: "Shape",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke={settings.lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          {settings.activeShape === "rectangle" && (
            <rect x="2" y="3" width="12" height="10" rx="1" />
          )}
          {settings.activeShape === "circle" && (
            <ellipse cx="8" cy="8" rx="6" ry="5" />
          )}
          {settings.activeShape === "triangle" && (
            <polygon points="8,2 14,14 2,14" />
          )}
          {settings.activeShape === "star" && (
            <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
          )}
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
        activeShape={settings.activeShape}
      />
      {hasTouch ? (
        <div className="fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center gap-1.5 px-2">
          <div
            className="relative flex items-center gap-1 p-1 rounded-lg border backdrop-blur-sm"
            style={{
              background: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
              borderColor: isDark
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,0,0,0.15)",
            }}
          >
            {touchTools.map((t) => {
              const hasLongPress = t.id === "shape" || t.id === "draw" || t.id === "dashed";
              const buttonRef = t.id === "shape" ? shapeButtonRef : t.id === "draw" ? drawButtonRef : t.id === "dashed" ? dashedButtonRef : undefined;
              return (
                <button
                  key={t.id}
                  ref={buttonRef}
                  onClick={() => {
                    if (shapeLongPressRef.current) {
                      clearTimeout(shapeLongPressRef.current);
                      shapeLongPressRef.current = null;
                    }
                    if (thicknessLongPressRef.current) {
                      clearTimeout(thicknessLongPressRef.current);
                      thicknessLongPressRef.current = null;
                    }
                    if (!showShapePicker && !showThicknessPicker) setTouchTool(t.id);
                    setShowShapePicker(false);
                    setShowThicknessPicker(null);
                  }}
                  onPointerDown={
                    hasLongPress
                      ? () => {
                          if (t.id === "shape") {
                            shapeLongPressRef.current = setTimeout(() => {
                              setShowShapePicker(true);
                              shapeLongPressRef.current = null;
                            }, 400);
                          } else if (t.id === "draw" || t.id === "dashed") {
                            thicknessLongPressRef.current = setTimeout(() => {
                              setShowThicknessPicker(t.id as "draw" | "dashed");
                              thicknessLongPressRef.current = null;
                            }, 400);
                          }
                        }
                      : undefined
                  }
                  onPointerUp={() => {
                    if (shapeLongPressRef.current) {
                      clearTimeout(shapeLongPressRef.current);
                      shapeLongPressRef.current = null;
                    }
                    if (thicknessLongPressRef.current) {
                      clearTimeout(thicknessLongPressRef.current);
                      thicknessLongPressRef.current = null;
                    }
                  }}
                  onPointerLeave={() => {
                    if (shapeLongPressRef.current) {
                      clearTimeout(shapeLongPressRef.current);
                      shapeLongPressRef.current = null;
                    }
                    if (thicknessLongPressRef.current) {
                      clearTimeout(thicknessLongPressRef.current);
                      thicknessLongPressRef.current = null;
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-2 rounded text-xs transition-colors ${
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
                </button>
              );
            })}
          </div>
          {showShapePicker && (
            <div
              className="absolute bottom-full mb-2 flex flex-col gap-1 p-1 rounded-lg border backdrop-blur-sm"
              style={{
                background: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                left: shapeButtonRef.current
                  ? shapeButtonRef.current.getBoundingClientRect().left +
                    shapeButtonRef.current.offsetWidth / 2 -
                    24
                  : "50%",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {(["rectangle", "circle", "triangle", "star"] as const).map((shape) => (
                <button
                  key={shape}
                  onClick={() => {
                    updateSettings({ activeShape: shape });
                    setTouchTool("shape");
                    setShowShapePicker(false);
                  }}
                  className={`p-2 rounded transition-colors ${
                    settings.activeShape === shape
                      ? isDark
                        ? "bg-white/20"
                        : "bg-black/20"
                      : isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-black/10"
                  }`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={settings.lineColor}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  >
                    {shape === "rectangle" && (
                      <rect x="2" y="3" width="12" height="10" rx="1" />
                    )}
                    {shape === "circle" && (
                      <ellipse cx="8" cy="8" rx="6" ry="5" />
                    )}
                    {shape === "triangle" && (
                      <polygon points="8,2 14,14 2,14" />
                    )}
                    {shape === "star" && (
                      <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
                    )}
                  </svg>
                </button>
              ))}
            </div>
          )}
          {showThicknessPicker && (
            <div
              className="absolute bottom-full mb-2 p-3 rounded-lg border backdrop-blur-sm"
              style={{
                background: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                left: (showThicknessPicker === "draw" ? drawButtonRef : dashedButtonRef).current
                  ? (showThicknessPicker === "draw" ? drawButtonRef : dashedButtonRef).current!.getBoundingClientRect().left +
                    (showThicknessPicker === "draw" ? drawButtonRef : dashedButtonRef).current!.offsetWidth / 2 -
                    60
                  : "50%",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className={`text-xs mb-2 ${isDark ? "text-white/70" : "text-black/70"}`}>
                Thickness: {settings.lineWidth}
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={settings.lineWidth}
                onChange={(e) => updateSettings({ lineWidth: Number(e.target.value) })}
                className={`w-24 ${isDark ? "accent-white/70" : "accent-black/70"}`}
              />
            </div>
          )}
          {settings.showZoomControls && (
            <div
              className="flex items-center gap-1 p-1 rounded-lg border backdrop-blur-sm"
              style={{
                background: isDark
                  ? "rgba(0,0,0,0.7)"
                  : "rgba(255,255,255,0.7)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.15)",
              }}
            >
              <button
                onClick={zoomOut}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-sm font-mono ${isDark ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/10"}`}
              >
                -
              </button>
              <span
                className={`text-[10px] tabular-nums text-center min-w-8 ${isDark ? "text-white/50" : "text-black/50"}`}
              >
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-sm font-mono ${isDark ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/10"}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      ) : (
        settings.showZoomControls && (
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
        )
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
      {showOnboarding && !hasTouch && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`px-8 py-6 rounded-lg border text-center max-w-xs ${isDark ? "bg-[#0a0a1a] border-white/15" : "bg-[#f5f5f0] border-black/15"}`}
          >
            <div
              className={`text-sm font-medium mb-4 ${isDark ? "text-white/90" : "text-black/90"}`}
            >
              Welcome to simpledraw
            </div>
            <div
              className={`text-xs space-y-2 text-left ${isDark ? "text-white/60" : "text-black/60"}`}
            >
              <div className="flex justify-between gap-6">
                <span>Draw</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  {mod} + drag
                </kbd>
              </div>
              <div className="flex justify-between gap-6">
                <span>Dashed line</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  Shift + drag
                </kbd>
              </div>
              <div className="flex justify-between gap-6">
                <span>Erase</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  {alt} + drag
                </kbd>
              </div>
              <div className="flex justify-between gap-6">
                <span>Clear</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  {mod} + K
                </kbd>
              </div>
            </div>
            <div
              className={`text-[10px] mt-4 ${isDark ? "text-white/30" : "text-black/30"}`}
            >
              Press any key or click to start
            </div>
          </div>
        </div>
      )}
    </>
  );
}
