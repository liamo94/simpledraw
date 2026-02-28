import {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import Canvas from "./components/Canvas";
import type { TouchTool } from "./components/Canvas";
import Menu from "./components/Menu";
import useSettings, {
  type ShapeKind,
  type Theme,
  type TextSize,
  type GridType,
  type FontFamily,
  type TextAlign,
} from "./hooks/useSettings";
import { isDarkTheme } from "./canvas/canvasUtils";

const SHAPES: ShapeKind[] = [
  "line",
  "rectangle",
  "circle",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
  "arrow",
  "lightning",
];

const isMac = navigator.platform.toUpperCase().includes("MAC");

// Migrate old single-canvas storage to canvas 1
(() => {
  const oldKey = "drawtool-strokes";
  const newKey = "drawtool-strokes-1";
  if (localStorage.getItem(oldKey) && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
    localStorage.removeItem(oldKey);
  }
})();

export default function App() {
  const [settings, updateSettings] = useSettings();

  const [zoom, setZoom] = useState(() => {
    try {
      const stored = localStorage.getItem("drawtool-active-canvas");
      const canvasIndex = stored ? parseInt(stored, 10) : 1;
      const raw = localStorage.getItem(`drawtool-view-${canvasIndex}`);
      if (raw) return (JSON.parse(raw) as { scale?: number }).scale ?? 1;
    } catch {}
    return 1;
  });
  const [touchTool, setTouchTool] = useState<TouchTool>("draw");
  const [hasTouch] = useState(
    () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("drawtool-onboarded"),
  );
  const [activeCanvas, setActiveCanvas] = useState(() => {
    const stored = localStorage.getItem("drawtool-active-canvas");
    const n = stored ? parseInt(stored, 10) : 1;
    return n >= 1 && n <= 9 ? n : 1;
  });
  const [canvasName, setCanvasName] = useState(() => {
    const stored = localStorage.getItem("drawtool-active-canvas");
    const n = stored ? parseInt(stored, 10) : 1;
    return localStorage.getItem(`drawtool-canvas-name-${n}`) ?? "";
  });
  const canvasNameInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [contentOffScreen, setContentOffScreen] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showThicknessPicker, setShowThicknessPicker] = useState<
    "draw" | "dashed" | "line" | "highlight" | null
  >(null);
  const [toast, setToast] = useState<
    | { type: "text"; message: string }
    | { type: "shape"; shape: ShapeKind }
    | { type: "toggle"; label: string; on: boolean }
    | null
  >(null);
  const [toastFading, setToastFading] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thicknessLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressFiredRef = useRef(false);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const drawButtonRef = useRef<HTMLButtonElement>(null);
  const dashedButtonRef = useRef<HTMLButtonElement>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Track last 2 used colors for swap (`,` shortcut)
  const usedColorARef = useRef(settings.lineColor); // most recently used
  const usedColorBRef = useRef(settings.lineColor); // previously used

  // Apply body styles based on theme
  useEffect(() => {
    const isDark = isDarkTheme(settings.theme);
    if (settings.theme === "midnight") {
      document.body.style.background = "#1a1a2e";
    } else if (settings.theme === "dark") {
      document.body.style.background = "#06060e";
    } else if (settings.theme === "lumber") {
      document.body.style.background = "#110e0a";
    } else if (settings.theme === "journal") {
      document.body.style.background = "#f5e2b8";
    } else if (settings.theme === "sky") {
      document.body.style.background = "#e0ecf6";
    } else {
      document.body.style.background = "#f5f5f0";
    }
    document.body.style.color = isDark
      ? "rgba(255,255,255,0.8)"
      : "rgba(0,0,0,0.8)";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [settings.theme]);

  // Swap default line color when theme changes between dark/light
  const prevThemeRef = useRef(settings.theme);
  useEffect(() => {
    if (prevThemeRef.current === settings.theme) return;
    const prevIsDark = isDarkTheme(prevThemeRef.current);
    const nowIsDark = isDarkTheme(settings.theme);
    prevThemeRef.current = settings.theme;
    const color = settingsRef.current.lineColor;
    if (!nowIsDark && prevIsDark && color === "#ffffff") {
      updateSettings({ lineColor: "#000000" });
    } else if (nowIsDark && !prevIsDark && color === "#000000") {
      updateSettings({ lineColor: "#ffffff" });
    }
  }, [settings.theme, updateSettings]);

  const [confirmingClear, setConfirmingClear] = useState(false);

  const doClear = useCallback(() => {
    setConfirmingClear(false);
    window.dispatchEvent(new Event("drawtool:clear"));
  }, []);

  const requestClear = useCallback(() => {
    if (settingsRef.current.confirmClear && !hasTouch) {
      const detail = { count: 0 };
      window.dispatchEvent(
        new CustomEvent("drawtool:query-stroke-count", { detail }),
      );
      if (detail.count > 10) {
        setConfirmingClear(true);
        return;
      }
    }
    doClear();
  }, [doClear]);

  const showToast = useCallback(
    (
      content:
        | { type: "text"; message: string }
        | { type: "shape"; shape: ShapeKind }
        | { type: "toggle"; label: string; on: boolean },
    ) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (toastFadeRef.current) clearTimeout(toastFadeRef.current);
      setToastFading(false);
      setToast(content);
      toastTimeoutRef.current = setTimeout(() => {
        setToastFading(true);
        toastFadeRef.current = setTimeout(() => {
          setToast(null);
          setToastFading(false);
        }, 250);
      }, 500);
    },
    [],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  const exportPng = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "drawtool.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  useEffect(() => {
    const onZoom = (e: Event) => setZoom((e as CustomEvent).detail);
    const onThickness = (e: Event) => {
      const delta = (e as CustomEvent).detail as number;
      const steps = [1, 2, 4, 6, 8, 10];
      const cur = settingsRef.current.lineWidth;
      const idx = steps.indexOf(cur);
      let nextIdx: number;
      if (idx === -1) {
        if (delta > 0) {
          nextIdx = steps.findIndex((s) => s > cur);
        } else {
          nextIdx = -1;
          for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i] < cur) {
              nextIdx = i;
              break;
            }
          }
        }
      } else {
        nextIdx = Math.min(steps.length - 1, Math.max(0, idx + delta));
      }
      if (nextIdx !== -1 && steps[nextIdx] !== cur) {
        updateSettings({ lineWidth: steps[nextIdx] });
        showToast({ type: "text", message: `Thickness: ${steps[nextIdx]}` });
      }
    };
    const onColorCycle = (e: Event) => {
      const dir = (e as CustomEvent).detail as number;
      const dark = isDarkTheme(settingsRef.current.theme);
      const palette = [
        dark ? "#ffffff" : "#000000",
        "#ef4444",
        "#fa8072",
        "#f97316",
        "#eab308",
        "#84cc16",
        "#22c55e",
        "#06b6d4",
        "#3b82f6",
        "#8b5cf6",
        "#b096f8",
        "#ec4899",
      ];
      const cur = settingsRef.current.lineColor;
      const idx = palette.indexOf(cur);
      const next =
        (idx === -1 ? 0 : idx + dir + palette.length) % palette.length;
      updateSettings({ lineColor: palette[next] });
    };
    const onColorUsed = (e: Event) => {
      const color = (e as CustomEvent).detail as string;
      if (color !== usedColorARef.current) {
        usedColorBRef.current = usedColorARef.current;
        usedColorARef.current = color;
      }
    };
    const onSwapColor = () => {
      const a = usedColorARef.current;
      const b = usedColorBRef.current;
      if (a !== b) {
        usedColorARef.current = b;
        usedColorBRef.current = a;
        updateSettings({ lineColor: b });
      }
    };
    const onRequestClear = () => requestClear();
    const onCycleShape = () => {
      const cur = settingsRef.current.activeShape;
      const idx = SHAPES.indexOf(cur);
      const next = (idx + 1) % SHAPES.length;
      updateSettings({ activeShape: SHAPES[next] });
      showToast({ type: "shape", shape: SHAPES[next] });
    };
    const onCycleShapeBack = () => {
      const cur = settingsRef.current.activeShape;
      const idx = SHAPES.indexOf(cur);
      const next = (idx - 1 + SHAPES.length) % SHAPES.length;
      updateSettings({ activeShape: SHAPES[next] });
      showToast({ type: "shape", shape: SHAPES[next] });
    };
    const onSwitchCanvas = (e: Event) => {
      const n = (e as CustomEvent).detail as number;
      if (n >= 1 && n <= 9) {
        setActiveCanvas(n);
        localStorage.setItem("drawtool-active-canvas", String(n));
        setCanvasName(localStorage.getItem(`drawtool-canvas-name-${n}`) ?? "");
        showToast({ type: "text", message: `Canvas ${n}` });
      }
    };
    const onFocusCanvasName = () => {
      setIsEditingName(true);
    };
    window.addEventListener("drawtool:zoom", onZoom);
    window.addEventListener("drawtool:thickness", onThickness);
    window.addEventListener("drawtool:color-cycle", onColorCycle);
    window.addEventListener("drawtool:color-used", onColorUsed);
    window.addEventListener("drawtool:swap-color", onSwapColor);
    window.addEventListener("drawtool:request-clear", onRequestClear);
    window.addEventListener("drawtool:cycle-shape", onCycleShape);
    window.addEventListener("drawtool:cycle-shape-back", onCycleShapeBack);
    window.addEventListener("drawtool:switch-canvas", onSwitchCanvas);
    window.addEventListener("drawtool:focus-canvas-name", onFocusCanvasName);
    const onTextSize = (e: Event) => {
      const size = (e as CustomEvent).detail as TextSize;
      updateSettings({ textSize: size });
    };
    const onFontFamily = (e: Event) => {
      const family = (e as CustomEvent).detail as FontFamily;
      updateSettings({ fontFamily: family });
    };
    const onSetColor = (e: Event) => {
      const color = (e as CustomEvent).detail as string;
      updateSettings({ lineColor: color });
    };
    const onTextStyleSync = (e: Event) => {
      updateSettings((e as CustomEvent).detail as { textBold: boolean; textItalic: boolean; textAlign: TextAlign });
    };
    const onToast = (e: Event) => {
      const message = (e as CustomEvent).detail as string;
      showToast({ type: "text", message });
    };
    const onToggleGrid = () => {
      const cycle: GridType[] = ["off", "dot", "square"];
      const cur = settingsRef.current.gridType;
      const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
      updateSettings({ gridType: next });
      showToast({ type: "text", message: `Grid: ${next}` });
    };
    const onToggleGridBack = () => {
      const cycle: GridType[] = ["off", "dot", "square"];
      const cur = settingsRef.current.gridType;
      const next =
        cycle[(cycle.indexOf(cur) - 1 + cycle.length) % cycle.length];
      updateSettings({ gridType: next });
      showToast({ type: "text", message: `Grid: ${next}` });
    };
    const onTogglePressure = () => {
      const next = !settingsRef.current.pressureSensitivity;
      updateSettings({ pressureSensitivity: next });
      showToast({ type: "toggle", label: "Dynamic stroke", on: next });
    };
    const onExportShortcut = () => exportPng();
    const THEMES: Theme[] = [
      "dark",
      "midnight",
      "lumber",
      "journal",
      "sky",
      "white",
    ];
    const THEME_LABELS: Record<Theme, string> = {
      dark: "Black",
      midnight: "Midnight",
      lumber: "Lumber",
      journal: "Journal",
      sky: "Sky",
      white: "White",
    };
    const onCycleTheme = (e: Event) => {
      const dir = (e as CustomEvent).detail === -1 ? -1 : 1;
      const cur = settingsRef.current.theme;
      const idx = THEMES.indexOf(cur);
      const next = (idx + dir + THEMES.length) % THEMES.length;
      updateSettings({ theme: THEMES[next] });
      showToast({ type: "text", message: THEME_LABELS[THEMES[next]] });
    };
    window.addEventListener("drawtool:toggle-fullscreen", toggleFullscreen);
    window.addEventListener("drawtool:toggle-grid", onToggleGrid);
    window.addEventListener("drawtool:toggle-grid-back", onToggleGridBack);
    window.addEventListener("drawtool:toggle-pressure", onTogglePressure);
    window.addEventListener("drawtool:export", onExportShortcut);
    window.addEventListener("drawtool:text-size", onTextSize);
    window.addEventListener("drawtool:font-family", onFontFamily);
    window.addEventListener("drawtool:set-color", onSetColor);
    window.addEventListener("drawtool:text-style-sync", onTextStyleSync);
    window.addEventListener("drawtool:toast", onToast);
    window.addEventListener("drawtool:cycle-theme", onCycleTheme);
    return () => {
      window.removeEventListener("drawtool:zoom", onZoom);
      window.removeEventListener("drawtool:thickness", onThickness);
      window.removeEventListener("drawtool:color-cycle", onColorCycle);
      window.removeEventListener("drawtool:color-used", onColorUsed);
      window.removeEventListener("drawtool:swap-color", onSwapColor);
      window.removeEventListener("drawtool:request-clear", onRequestClear);
      window.removeEventListener("drawtool:cycle-shape", onCycleShape);
      window.removeEventListener("drawtool:cycle-shape-back", onCycleShapeBack);
      window.removeEventListener("drawtool:switch-canvas", onSwitchCanvas);
      window.removeEventListener(
        "drawtool:focus-canvas-name",
        onFocusCanvasName,
      );
      window.removeEventListener(
        "drawtool:toggle-fullscreen",
        toggleFullscreen,
      );
      window.removeEventListener("drawtool:toggle-grid", onToggleGrid);
      window.removeEventListener("drawtool:toggle-grid-back", onToggleGridBack);
      window.removeEventListener("drawtool:toggle-pressure", onTogglePressure);
      window.removeEventListener("drawtool:export", onExportShortcut);
      window.removeEventListener("drawtool:text-size", onTextSize);
      window.removeEventListener("drawtool:font-family", onFontFamily);
      window.removeEventListener("drawtool:set-color", onSetColor);
      window.removeEventListener("drawtool:text-style-sync", onTextStyleSync);
      window.removeEventListener("drawtool:toast", onToast);
      window.removeEventListener("drawtool:cycle-theme", onCycleTheme);
    };
  }, [updateSettings, requestClear, showToast, toggleFullscreen, exportPng]);

  // Confirmation overlay keyboard handler — capture phase to block Canvas
  useEffect(() => {
    if (!confirmingClear) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === "Enter" || ((e.metaKey || e.ctrlKey) && e.key === "x")) {
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
    window.dispatchEvent(new Event("drawtool:reset-view"));
    setZoom(1);
  }, []);

  const centerView = useCallback(() => {
    window.dispatchEvent(new Event("drawtool:center-view"));
  }, []);

  const exportTransparent = useCallback(() => {
    window.dispatchEvent(new Event("drawtool:export-transparent"));
  }, []);

  const zoomIn = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:zoom-step", { detail: 1.25 }),
    );
  }, []);

  const zoomOut = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:zoom-step", { detail: 0.8 }),
    );
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("drawtool-onboarded", "1");
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

  const isDark = isDarkTheme(settings.theme);
  const mod = isMac ? "\u2318" : "Ctrl";
  const alt = isMac ? "\u2325" : "Alt";

  const touchTools: { id: TouchTool; label: string; icon: ReactNode }[] =
    useMemo(
      () => [
        {
          id: "hand",
          label: "Move",
          icon: (
            <svg
              width="17"
              height="17"
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
              width="17"
              height="17"
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
              width="17"
              height="17"
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
          id: "shape",
          label: "Shape",
          icon: (
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              stroke={settings.lineColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              {settings.activeShape === "line" && (
                <line x1="3" y1="13" x2="13" y2="3" strokeLinecap="round" />
              )}
              {settings.activeShape === "rectangle" && (
                <rect x="2" y="3" width="12" height="10" rx="1" />
              )}
              {settings.activeShape === "circle" && (
                <circle cx="8" cy="8" r="6" />
              )}
              {settings.activeShape === "triangle" && (
                <polygon points="8,2 14,14 2,14" />
              )}
              {settings.activeShape === "diamond" && (
                <polygon points="8,1 15,8 8,15 1,8" />
              )}
              {settings.activeShape === "pentagon" && (
                <polygon points="8,2 14.5,6.5 12,14 4,14 1.5,6.5" />
              )}
              {settings.activeShape === "hexagon" && (
                <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" />
              )}
              {settings.activeShape === "star" && (
                <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
              )}
              {settings.activeShape === "arrow" && (
                <>
                  <line x1="2" y1="8" x2="12" y2="8" />
                  <polyline points="9,5 12,8 9,11" />
                </>
              )}
              {settings.activeShape === "lightning" && (
                <polygon points="9,1 3,8.5 7.5,8.5 6,15 13,7 8.5,7" />
              )}
            </svg>
          ),
        },
        {
          id: "highlight",
          label: "Mark",
          icon: (
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              stroke={settings.lineColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.4"
            >
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          ),
        },
        {
          id: "erase",
          label: "Erase",
          icon: (
            <svg width="18" height="18" viewBox="0 0 16 16">
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
      ],
      [settings.lineColor, settings.activeShape],
    );

  return (
    <>
      <Menu
        settings={settings}
        updateSettings={updateSettings}
        onExport={exportPng}
        onExportTransparent={exportTransparent}
        onClear={requestClear}
        hasTouch={hasTouch}
        activeCanvas={activeCanvas}
        onSwitchCanvas={(n) => {
          setActiveCanvas(n);
          localStorage.setItem("drawtool-active-canvas", String(n));
        }}
        onToggleFullscreen={toggleFullscreen}
        onResetView={resetView}
      />
      <Canvas
        lineWidth={settings.lineWidth}
        lineColor={settings.lineColor}
        dashGap={settings.dashGap}
        gridType={settings.gridType}
        theme={settings.theme}
        touchTool={touchTool}
        activeShape={settings.activeShape}
        shapeFill={settings.shapeFill}
        shapeDashed={settings.shapeDashed}
        canvasIndex={activeCanvas}
        textSize={settings.textSize}
        fontFamily={settings.fontFamily}
        textBold={settings.textBold}
        textItalic={settings.textItalic}
        textAlign={settings.textAlign}
        pressureSensitivity={settings.pressureSensitivity}
        onContentOffScreen={setContentOffScreen}
      />
      {hasTouch ? (
        <>
          {(showShapePicker || showThicknessPicker) && (
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => {
                setShowShapePicker(false);
                setShowThicknessPicker(null);
              }}
            />
          )}
          <nav
            aria-label="Drawing tools"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-1 touch-toolbar"
          >
            <div
              className="relative flex items-center gap-0.5 sm:gap-1 p-1 rounded-lg border backdrop-blur-sm"
              style={{
                background: isDark
                  ? "rgba(0,0,0,0.7)"
                  : "rgba(255,255,255,0.7)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.15)",
              }}
            >
              {touchTools.map((t) => {
                const hasLongPress =
                  t.id === "shape" ||
                  t.id === "draw" ||
                  t.id === "dashed" ||
                  t.id === "line" ||
                  t.id === "highlight";
                const buttonRef =
                  t.id === "shape"
                    ? shapeButtonRef
                    : t.id === "draw"
                      ? drawButtonRef
                      : t.id === "dashed"
                        ? dashedButtonRef
                        : undefined;
                return (
                  <button
                    key={t.id}
                    ref={buttonRef}
                    aria-label={t.label}
                    aria-pressed={touchTool === t.id}
                    onClick={() => {
                      if (shapeLongPressRef.current) {
                        clearTimeout(shapeLongPressRef.current);
                        shapeLongPressRef.current = null;
                      }
                      if (thicknessLongPressRef.current) {
                        clearTimeout(thicknessLongPressRef.current);
                        thicknessLongPressRef.current = null;
                      }
                      if (longPressFiredRef.current) {
                        longPressFiredRef.current = false;
                        return;
                      }
                      if (!showShapePicker && !showThicknessPicker)
                        setTouchTool(t.id);
                      setShowShapePicker(false);
                      setShowThicknessPicker(null);
                    }}
                    onPointerDown={
                      hasLongPress
                        ? () => {
                            if (t.id === "shape") {
                              shapeLongPressRef.current = setTimeout(() => {
                                setShowShapePicker(true);
                                setShowThicknessPicker(null);
                                setTouchTool(t.id);
                                shapeLongPressRef.current = null;
                                longPressFiredRef.current = true;
                              }, 400);
                            } else if (
                              t.id === "draw" ||
                              t.id === "dashed" ||
                              t.id === "line" ||
                              t.id === "highlight"
                            ) {
                              thicknessLongPressRef.current = setTimeout(() => {
                                setShowThicknessPicker(
                                  t.id as
                                    | "draw"
                                    | "dashed"
                                    | "line"
                                    | "highlight",
                                );
                                setShowShapePicker(false);
                                setTouchTool(t.id);
                                thicknessLongPressRef.current = null;
                                longPressFiredRef.current = true;
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
                    className={`flex items-center gap-1 px-2.5 py-2.5 sm:px-3 sm:py-3 rounded text-xs transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
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
              {showThicknessPicker && (
                <div
                  className="absolute bottom-full mb-2 left-0 right-0 p-3 rounded-lg border backdrop-blur-sm"
                  style={{
                    background: isDark
                      ? "rgba(0,0,0,0.85)"
                      : "rgba(255,255,255,0.85)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.15)",
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-1.5 flex-wrap justify-center mb-3">
                    {[
                      isDark ? "#ffffff" : "#000000",
                      "#ef4444",
                      "#fa8072",
                      "#f97316",
                      "#eab308",
                      "#84cc16",
                      "#22c55e",
                      "#06b6d4",
                      "#3b82f6",
                      "#8b5cf6",
                      "#b096f8",
                      "#ec4899",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateSettings({ lineColor: color })}
                        aria-label={`Color ${color}`}
                        aria-pressed={settings.lineColor === color}
                        className="w-6 h-6 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-blue-400"
                        style={{
                          backgroundColor: color,
                          borderColor:
                            settings.lineColor === color
                              ? isDark
                                ? "white"
                                : "black"
                              : "transparent",
                          transform:
                            settings.lineColor === color
                              ? "scale(1.15)"
                              : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      className={isDark ? "text-white/70" : "text-black/70"}
                    >
                      {showThicknessPicker === "dashed"
                        ? "Dash gap"
                        : "Thickness"}
                    </span>
                    <span
                      className={`tabular-nums ${isDark ? "text-white/40" : "text-black/40"}`}
                    >
                      {showThicknessPicker === "dashed"
                        ? settings.dashGap
                        : settings.lineWidth}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 4, 6, 8, 10].map((n) => {
                      const isDashed = showThicknessPicker === "dashed";
                      const current = isDashed
                        ? settings.dashGap
                        : settings.lineWidth;
                      return (
                        <button
                          key={n}
                          onClick={() =>
                            updateSettings(
                              isDashed ? { dashGap: n } : { lineWidth: n },
                            )
                          }
                          aria-label={`${isDashed ? "Dash gap" : "Thickness"} ${n}`}
                          aria-pressed={current === n}
                          className="flex-1 flex items-center justify-center py-1.5 group"
                        >
                          <div
                            className={`transition-all duration-150 ${current >= n ? "" : isDark ? "group-hover:!bg-white/30" : "group-hover:!bg-black/25"}`}
                            style={{
                              width: isDashed
                                ? `${4 + n * 2.8}px`
                                : `${4 + n * 2}px`,
                              height: isDashed ? 4 : `${4 + n * 2}px`,
                              borderRadius: isDashed ? 2 : 9999,
                              background:
                                current >= n
                                  ? isDark
                                    ? "rgba(255,255,255,0.85)"
                                    : "rgba(0,0,0,0.8)"
                                  : isDark
                                    ? "rgba(255,255,255,0.15)"
                                    : "rgba(0,0,0,0.12)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {showShapePicker && (
              <div
                className="absolute bottom-full mb-2 flex flex-wrap gap-1 p-1 rounded-lg border backdrop-blur-sm"
                style={{
                  background: isDark
                    ? "rgba(0,0,0,0.85)"
                    : "rgba(255,255,255,0.85)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.15)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  maxWidth: "calc(100vw - 2rem)",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex w-full gap-1 pb-1 mb-0.5" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}` }}>
                  <button
                    aria-label="Fill shape"
                    aria-pressed={settings.shapeFill}
                    onClick={() => updateSettings({ shapeFill: !settings.shapeFill })}
                    className={`flex-1 flex items-center justify-center p-2 rounded transition-colors ${
                      settings.shapeFill
                        ? isDark ? "bg-white/20" : "bg-black/20"
                        : isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke={settings.lineColor} strokeWidth="1.5" strokeLinejoin="round" opacity={settings.shapeFill ? 1 : 0.35}>
                      <rect x="2" y="2" width="12" height="12" rx="1.5" fill={settings.lineColor} />
                    </svg>
                  </button>
                  <button
                    aria-label="Dashed shape"
                    aria-pressed={settings.shapeDashed}
                    onClick={() => updateSettings({ shapeDashed: !settings.shapeDashed })}
                    className={`flex-1 flex items-center justify-center p-2 rounded transition-colors ${
                      settings.shapeDashed
                        ? isDark ? "bg-white/20" : "bg-black/20"
                        : isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke={settings.lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3.5 2.5" opacity={settings.shapeDashed ? 1 : 0.35}>
                      <rect x="2" y="2" width="12" height="12" rx="1.5" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 w-full">
                {SHAPES.map((shape) => (
                  <button
                    key={shape}
                    aria-label={shape.charAt(0).toUpperCase() + shape.slice(1)}
                    aria-pressed={settings.activeShape === shape}
                    onClick={() => {
                      updateSettings({ activeShape: shape });
                      setTouchTool("shape");
                      setShowShapePicker(false);
                    }}
                    className={`flex items-center justify-center p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
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
                      {shape === "line" && (
                        <line
                          x1="3"
                          y1="13"
                          x2="13"
                          y2="3"
                          strokeLinecap="round"
                        />
                      )}
                      {shape === "rectangle" && (
                        <rect x="2" y="3" width="12" height="10" rx="1" />
                      )}
                      {shape === "circle" && <circle cx="8" cy="8" r="6" />}
                      {shape === "triangle" && (
                        <polygon points="8,2 14,14 2,14" />
                      )}
                      {shape === "diamond" && (
                        <polygon points="8,1 15,8 8,15 1,8" />
                      )}
                      {shape === "pentagon" && (
                        <polygon points="8,2 14.5,6.5 12,14 4,14 1.5,6.5" />
                      )}
                      {shape === "hexagon" && (
                        <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" />
                      )}
                      {shape === "star" && (
                        <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
                      )}
                      {shape === "arrow" && (
                        <>
                          <line x1="2" y1="8" x2="12" y2="8" />
                          <polyline points="9,5 12,8 9,11" />
                        </>
                      )}
                      {shape === "lightning" && (
                        <polygon points="9,1 3,8.5 7.5,8.5 6,15 13,7 8.5,7" />
                      )}
                    </svg>
                  </button>
                ))}
                </div>
              </div>
            )}
          </nav>
        </>
      ) : (
        settings.showZoomControls && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
            <div
              className={`flex items-center h-8 rounded-lg border ${isDark ? "border-white/20" : "border-black/20"}`}
            >
              <button
                onClick={zoomOut}
                aria-label="Zoom out"
                className={`w-8 h-full flex items-center justify-center rounded-l-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "bg-white/10 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 text-black/70 hover:text-black hover:bg-black/20"}`}
              >
                -
              </button>
              <div
                className={`w-px h-full ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
              <div className="relative group/zoom h-full">
                <div
                  className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs whitespace-nowrap rounded opacity-0 group-hover/zoom:opacity-100 transition-opacity ${isDark ? "bg-white/90 text-black" : "bg-black/90 text-white"}`}
                >
                  Reset zoom
                </div>
                <button
                  onClick={resetView}
                  aria-label="Reset zoom to 100%"
                  className={`min-w-[3.25rem] px-2 h-full flex items-center justify-center transition-colors text-xs tabular-nums focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "bg-white/10 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 text-black/70 hover:text-black hover:bg-black/20"}`}
                >
                  {Math.round(zoom * 100)}%
                </button>
              </div>
              <div
                className={`w-px h-full ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
              <button
                onClick={zoomIn}
                aria-label="Zoom in"
                className={`w-8 h-full flex items-center justify-center rounded-r-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "bg-white/10 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 text-black/70 hover:text-black hover:bg-black/20"}`}
              >
                +
              </button>
            </div>
            <div className="relative group">
              <div
                className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "bg-white/90 text-black" : "bg-black/90 text-white"}`}
              >
                Fit to content
              </div>
              <button
                onClick={centerView}
                aria-label="Fit to content"
                className={`w-8 h-8 flex items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
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
            </div>
          </div>
        )
      )}
      {contentOffScreen && (
        <button
          onClick={centerView}
          aria-label="Scroll back to content"
          className={`fixed z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium backdrop-blur-sm transition-colors duration-200 animate-fade-in-up ${isDark ? "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white" : "bg-black/10 border-black/20 text-black/80 hover:bg-black/20 hover:text-black"}`}
          style={{
            bottom: hasTouch ? "4.5rem" : "1rem",
            left: "50%",
            transform: "translateX(-50%)",
          }}
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
          Scroll back to content
        </button>
      )}
      <div
        className="fixed top-2 left-2 z-30 select-none flex items-center gap-1.5"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className="text-2xl tabular-nums tracking-wider pointer-events-none"
          style={{
            color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
            fontFamily: "'Caveat', cursive",
          }}
        >
          {activeCanvas}
        </div>
        {!hasTouch && (
          isEditingName ? (
            <input
              ref={canvasNameInputRef}
              value={canvasName}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setCanvasName(e.target.value);
                localStorage.setItem(
                  `drawtool-canvas-name-${activeCanvas}`,
                  e.target.value,
                );
              }}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape")
                  e.currentTarget.blur();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              className="w-auto bg-transparent border-none outline-none text-[19px]"
              style={{
                width: `${canvasName?.length ? canvasName.length + 2 : 2}ch`,
                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                fontFamily: "'Caveat', cursive",
              }}
            />
          ) : (
            <span
              className="text-[19px] pointer-events-none select-none"
              style={{
                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                fontFamily: "'Caveat', cursive",
              }}
            >
              {canvasName}
            </span>
          )
        )}
      </div>
      {confirmingClear && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
          className="fixed inset-0 flex items-center justify-center"
          onClick={() => setConfirmingClear(false)}
        >
          <div
            className={`px-8 py-4 rounded-lg border backdrop-blur-sm text-center ${isDark ? "bg-black/80 border-white/15" : "bg-white/80 border-black/15"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="clear-dialog-title"
              className={`text-sm font-medium ${isDark ? "text-white/90" : "text-black/90"}`}
            >
              Clear all strokes?
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setConfirmingClear(false)}
                className={`flex-1 px-8 py-1.5 rounded text-xs transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
              >
                Cancel
              </button>
              <button
                onClick={doClear}
                className={`flex-1 px-8 py-1.5 rounded text-xs transition-colors ${isDark ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20" : "text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20"}`}
              >
                <span className="whitespace-nowrap">
                  Clear ({isMac ? "\u2318" : "Ctrl"}+X)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {showOnboarding && !hasTouch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to drawtool"
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div
            className={`px-8 py-6 rounded-lg border backdrop-blur-sm text-center max-w-xs ${isDark ? "bg-black/70 border-white/15" : "bg-white/70 border-black/15"}`}
          >
            <div
              className="text-xl mb-4 select-none"
              style={{ fontFamily: "Pacifico, cursive" }}
            >
              {[
                { letter: "d", color: "#3b82f6", rotate: -6 },
                { letter: "r", color: "#ef4444", rotate: 3 },
                { letter: "a", color: "#22c55e", rotate: -4 },
                { letter: "w", color: "#eab308", rotate: 5 },
                { letter: "t", color: "#ec4899", rotate: -3 },
                { letter: "o", color: "#f97316", rotate: 4 },
                { letter: "o", color: "#8b5cf6", rotate: -5 },
                { letter: "l", color: "#06b6d4", rotate: 3 },
              ].map((l, i) => (
                <span
                  key={i}
                  style={{
                    color: l.color,
                    display: "inline-block",
                    marginLeft: i === 0 ? 0 : 2,
                    transform: `rotate(${l.rotate}deg)`,
                    textShadow: isDark
                      ? `0 0 8px ${l.color}44`
                      : `1px 1px 0 ${l.color}22`,
                  }}
                >
                  {l.letter}
                </span>
              ))}
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
                <span>Shape</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  {isMac ? "Ctrl" : `${alt} + Shift`} + drag
                </kbd>
              </div>
              <div className="flex justify-between gap-6">
                <span>Write text</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  T
                </kbd>
              </div>
              <div className="flex justify-between gap-6">
                <span>Clear</span>
                <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                  {mod} + X
                </kbd>
              </div>
            </div>
            <div
              className={`text-[10px] mt-4 ${isDark ? "text-white/30" : "text-black/30"}`}
            >
              Open the menu (M) for all shortcuts
            </div>
            <div
              className={`text-[10px] mt-1.5 ${isDark ? "text-white/30" : "text-black/30"}`}
            >
              Press any key or click to start
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-14 z-40 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-medium shadow-lg pointer-events-none flex items-center gap-1.5 ${toastFading ? "animate-toast-out" : "animate-toast-in"}`}
          style={{
            background: isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.75)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
            boxShadow: isDark
              ? "0 4px 12px rgba(0,0,0,0.4)"
              : "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {toast.type === "toggle" ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: toast.on
                    ? "#22c55e"
                    : isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.2)",
                  boxShadow: toast.on ? "0 0 6px #22c55e88" : "none",
                  flexShrink: 0,
                }}
              />
              {toast.label}
            </>
          ) : toast.type === "text" ? (
            toast.message
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              {toast.shape === "line" && (
                <line x1="3" y1="13" x2="13" y2="3" strokeLinecap="round" />
              )}
              {toast.shape === "rectangle" && (
                <rect x="2" y="3" width="12" height="10" rx="1" />
              )}
              {toast.shape === "circle" && <circle cx="8" cy="8" r="6" />}
              {toast.shape === "triangle" && (
                <polygon points="8,2 14,14 2,14" />
              )}
              {toast.shape === "diamond" && (
                <polygon points="8,1 15,8 8,15 1,8" />
              )}
              {toast.shape === "pentagon" && (
                <polygon points="8,2 14.5,6.5 12,14 4,14 1.5,6.5" />
              )}
              {toast.shape === "hexagon" && (
                <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" />
              )}
              {toast.shape === "star" && (
                <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
              )}
              {toast.shape === "arrow" && (
                <>
                  <line x1="2" y1="8" x2="12" y2="8" />
                  <polyline points="9,5 12,8 9,11" />
                </>
              )}
              {toast.shape === "lightning" && (
                <polygon points="9,1 3,8.5 7.5,8.5 6,15 13,7 8.5,7" />
              )}
            </svg>
          )}
        </div>
      )}
    </>
  );
}
