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
import Training from "./components/Training";
import useSettings, {
  type ShapeKind,
  type Theme,
  type TextSize,
  type GridType,
  type FontFamily,
  type TextAlign,
  type FillStyle,
} from "./hooks/useSettings";

import { isDarkTheme, getBackgroundColor } from "./canvas/canvasUtils";
import {
  loadStrokes,
  saveStrokes,
  validateStrokesFile,
  strokesKey,
} from "./canvas/storage";

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
  "cloud",
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

// Detect /training route
let _trainingRoute = false;
if (window.location.pathname === "/training") {
  _trainingRoute = true;
}

// Compute /new routing before first render
let _newRouteCanvas: number | null = null;
let _newRouteAllOccupied = false;

if (window.location.pathname === "/new") {
  window.history.replaceState(null, "", "/");
  const counts = Array.from({ length: 9 }, (_, i) => {
    const raw = localStorage.getItem(strokesKey(i + 1));
    if (!raw) return 0;
    try {
      return (JSON.parse(raw) as unknown[]).length;
    } catch {
      return 0;
    }
  });
  const empty = counts.findIndex((n) => n === 0);
  if (empty !== -1) {
    _newRouteCanvas = empty + 1;
  } else {
    const min = Math.min(...counts);
    _newRouteCanvas = counts.findIndex((n) => n === min) + 1;
    _newRouteAllOccupied = true;
  }
  localStorage.setItem("drawtool-active-canvas", String(_newRouteCanvas));
}

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
  const [exportFormat, setExportFormat] = useState<"png" | "svg">(
    () =>
      (localStorage.getItem("drawtool-export-format") as "png" | "svg") ??
      "png",
  );
  const [exportTransparentBg, setExportTransparentBg] = useState(
    () => localStorage.getItem("drawtool-export-transparent") === "1",
  );
  const exportFormatRef = useRef(exportFormat);
  const exportTransparentBgRef = useRef(exportTransparentBg);
  const [showThicknessPicker, setShowThicknessPicker] = useState<
    "draw" | "dashed" | "line" | null
  >(null);
  const [toast, setToast] = useState<
    | { type: "text"; message: string }
    | { type: "shape"; shape: ShapeKind }
    | { type: "toggle"; label: string; on: boolean }
    | { type: "fill"; fill: FillStyle }
    | { type: "corners"; corners: "rounded" | "sharp" }
    | { type: "challenge"; message: string }
    | null
  >(null);
  const [toastFading, setToastFading] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [lastMarkTool, setLastMarkTool] = useState<
    "highlight" | "laser" | "spray"
  >("highlight");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [, setMenuOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const onResize = () => setIsTablet(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const shapeLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thicknessLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const highlightLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressFiredRef = useRef(false);
  const handLastTapRef = useRef<number>(0);
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
    const bg = getBackgroundColor(settings.theme);
    document.body.style.background = bg;
    document.documentElement.style.background = bg;
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

  const [showTraining, setShowTraining] = useState(_trainingRoute);
  const [trainingFlash, setTrainingFlash] = useState(false);

  const openTraining = useCallback(() => {
    history.pushState(null, "", "/training");
    setShowTraining(true);
    setTrainingFlash(true);
    setTimeout(() => setTrainingFlash(false), 1200);
  }, []);

  // Training nudge notification
  const MAX_NUDGES = 3;
  const NUDGE_KEY = "drawtool-training-nudge-count";
  const [showTrainingNudge, setShowTrainingNudge] = useState(false);
  useEffect(() => {
    if (showTraining) return;
    const count = parseInt(localStorage.getItem(NUDGE_KEY) ?? "0", 10);
    if (count >= MAX_NUDGES) return;
    const delay = 10000 + Math.random() * 20000; // 10–30s
    const t = setTimeout(() => {
      setShowTrainingNudge(true);
      localStorage.setItem(NUDGE_KEY, String(count + 1));
    }, delay);
    return () => clearTimeout(t);
  }, [showTraining]);

  const dismissNudge = (permanent: boolean) => {
    setShowTrainingNudge(false);
    if (permanent) localStorage.setItem(NUDGE_KEY, String(MAX_NUDGES));
  };

  // Sync training state with URL (back/forward navigation)
  useEffect(() => {
    const onPopState = () => {
      const isTraining = window.location.pathname === "/training";
      setShowTraining(isTraining);
      if (isTraining) {
        setTrainingFlash(true);
        setTimeout(() => setTrainingFlash(false), 1200);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Sandbox: clear training canvas (slot 0) each time training opens
  useEffect(() => {
    if (showTraining) {
      localStorage.removeItem("drawtool-strokes-0");
      localStorage.removeItem("drawtool-view-0");
      window.dispatchEvent(new Event("drawtool:reset-view"));
      setZoom(1);
    }
  }, [showTraining]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [newCanvasDialogOpen, setNewCanvasDialogOpen] =
    useState(_newRouteAllOccupied);
  const [newCanvasBlurred, setNewCanvasBlurred] =
    useState(_newRouteAllOccupied);

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
        | { type: "toggle"; label: string; on: boolean }
        | { type: "fill"; fill: FillStyle }
        | { type: "corners"; corners: "rounded" | "sharp" }
        | { type: "challenge"; message: string },
      duration = 500,
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
      }, duration);
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
      a.download = `drawtool-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  const importFileRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const dropZoneCounterRef = useRef(0);

  const exportData = useCallback(() => {
    const strokes = loadStrokes(activeCanvas);
    const file = { version: 1, strokes };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canvas-${activeCanvas}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeCanvas]);

  const processImportFile = useCallback(
    (file: File) => {
      file.text().then((text) => {
        try {
          const strokes = validateStrokesFile(JSON.parse(text));
          saveStrokes(strokes, activeCanvas);
          window.dispatchEvent(
            new CustomEvent("drawtool:import-strokes", { detail: strokes }),
          );
          showToast({
            type: "text",
            message: `Imported ${strokes.length} stroke${strokes.length !== 1 ? "s" : ""}`,
          });
        } catch (err) {
          showToast({
            type: "text",
            message: `Import failed: ${(err as Error).message}`,
          });
        }
      });
    },
    [activeCanvas, showToast],
  );

  const importData = useCallback(() => {
    setShowImportModal(true);
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setShowImportModal(false);
      processImportFile(file);
    },
    [processImportFile],
  );

  useEffect(() => {
    if (!showImportModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowImportModal(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [showImportModal]);

  useEffect(() => {
    const onState = (e: Event) => {
      const { canUndo, canRedo, hasSelection } = (e as CustomEvent).detail;
      setCanUndo(canUndo);
      setCanRedo(canRedo);
      setHasSelection(hasSelection);
    };
    const onMenuState = (e: Event) => {
      const open = (e as CustomEvent).detail as boolean;
      setMenuOpen(open);
      if (open) {
        setShowShapePicker(false);
        setShowThicknessPicker(null);
        setShowHighlightPicker(false);
      }
    };
    window.addEventListener("drawtool:state", onState);
    window.addEventListener("drawtool:menu-state", onMenuState);
    return () => {
      window.removeEventListener("drawtool:state", onState);
      window.removeEventListener("drawtool:menu-state", onMenuState);
    };
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
        dark ? "#000000" : "#ffffff",
        "#ef4444",
        "#ff7f50",
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
      window.dispatchEvent(
        new CustomEvent("drawtool:set-color", { detail: palette[next] }),
      );
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
        window.dispatchEvent(
          new CustomEvent("drawtool:set-color", { detail: b }),
        );
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
      updateSettings(
        (e as CustomEvent).detail as {
          textBold: boolean;
          textItalic: boolean;
          textAlign: TextAlign;
        },
      );
    };
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const message =
        typeof detail === "object" ? detail.message : (detail as string);
      const duration = typeof detail === "object" ? detail.duration : undefined;
      const isChallenge = typeof detail === "object" && detail.challenge;
      showToast({ type: isChallenge ? "challenge" : "text", message }, duration);
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
    const onToggleCorners = () => {
      const next =
        settingsRef.current.shapeCorners === "rounded" ? "sharp" : "rounded";
      updateSettings({ shapeCorners: next });
      showToast({ type: "corners", corners: next });
    };
    const FILLS: FillStyle[] = ["solid", "dots", "hatch", "crosshatch"];
    const onCycleFill = () => {
      const cur = settingsRef.current.shapeFill;
      const next = FILLS[(FILLS.indexOf(cur) + 1) % FILLS.length];
      updateSettings({ shapeFill: next });
      showToast({ type: "fill", fill: next });
    };
    const onExportShortcut = () => {
      if (exportFormatRef.current === "svg")
        exportSvgFn(exportTransparentBgRef.current);
      else if (exportTransparentBgRef.current) exportTransparent();
      else exportPng();
    };
    const THEMES: Theme[] = [
      "dark",
      "midnight",
      "lumber",
      "slate",
      "journal",
      "sky",
      "sand",
      "white",
    ];
    const THEME_LABELS: Record<Theme, string> = {
      dark: "Black",
      midnight: "Midnight",
      lumber: "Lumber",
      slate: "Slate",
      journal: "Journal",
      sky: "Sky",
      sand: "Sand",
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
    window.addEventListener("drawtool:toggle-corners", onToggleCorners);
    window.addEventListener("drawtool:cycle-fill", onCycleFill);
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
      window.removeEventListener("drawtool:toggle-corners", onToggleCorners);
      window.removeEventListener("drawtool:cycle-fill", onCycleFill);
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

  // New-canvas dialog keyboard trap
  useEffect(() => {
    if (!newCanvasDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === "Escape") {
        setNewCanvasDialogOpen(false);
        setNewCanvasBlurred(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "x") {
        window.dispatchEvent(new Event("drawtool:clear"));
        window.dispatchEvent(new Event("drawtool:reset-view"));
        setZoom(1);
        setNewCanvasDialogOpen(false);
        setNewCanvasBlurred(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [newCanvasDialogOpen]);

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

  const exportSvgFn = useCallback((transparent: boolean) => {
    window.dispatchEvent(
      new CustomEvent("drawtool:export-svg", { detail: { transparent } }),
    );
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
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
              <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
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
              {settings.activeShape === "cloud" && (
                <path d="M 4.8,12 H 11.2 C 12.9,12 14.3,10.8 14.3,9.3 C 14.3,7.9 13.3,6.9 12,6.7 C 11.6,5.2 10.3,4.1 8.6,4.1 C 7.1,4.1 5.9,5 5.3,6.3 C 3.7,6.5 2.5,7.7 2.5,9.2 C 2.5,10.8 3.7,12 4.8,12 Z" />
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
        {
          id: "select",
          label: "Select",
          icon: (
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 2l4.5 11 2-4.5L13 6.5z" />
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
        onExport={(format, transparent) => {
          if (format === "svg") exportSvgFn(transparent);
          else if (transparent) exportTransparent();
          else exportPng();
        }}
        exportFormat={exportFormat}
        exportTransparentBg={exportTransparentBg}
        onSetExportFormat={(f) => {
          setExportFormat(f);
          exportFormatRef.current = f;
          localStorage.setItem("drawtool-export-format", f);
        }}
        onSetExportTransparentBg={(v) => {
          setExportTransparentBg(v);
          exportTransparentBgRef.current = v;
          localStorage.setItem("drawtool-export-transparent", v ? "1" : "0");
        }}
        hasTouch={hasTouch}
        activeCanvas={activeCanvas}
        onSwitchCanvas={(n) => {
          setActiveCanvas(n);
          localStorage.setItem("drawtool-active-canvas", String(n));
        }}
        onToggleFullscreen={toggleFullscreen}
        onResetView={resetView}
        onExportData={exportData}
        onImportData={importData}
        onStartTraining={openTraining}
      />
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
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
        shapeFillEnabled={settings.shapeFillEnabled}
        fillOpacity={settings.fillOpacity}
        shapeDashed={settings.shapeDashed}
        shapeCorners={settings.shapeCorners}
        key={showTraining ? "training" : String(activeCanvas)}
        canvasIndex={showTraining ? 0 : activeCanvas}
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
          {(showShapePicker || showThicknessPicker || showHighlightPicker) && (
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => {
                setShowShapePicker(false);
                setShowThicknessPicker(null);
                setShowHighlightPicker(false);
              }}
            />
          )}
          {/* Undo / Redo / Delete — tablet: fixed bottom-left; mobile: above toolbar right-aligned */}
          {isTablet && (
            <div className="fixed bottom-4 left-4 z-50 flex items-center gap-0.5">
              <button
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => window.dispatchEvent(new Event("drawtool:undo"))}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canUndo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 8.5H12C14.5 8.5 16.5 10.5 16.5 13S14.5 17.5 12 17.5H7" />
                  <path d="M7 5.5L4 8.5l3 3" />
                </svg>
              </button>
              <button
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => window.dispatchEvent(new Event("drawtool:redo"))}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canRedo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 8.5H8C5.5 8.5 3.5 10.5 3.5 13S5.5 17.5 8 17.5H13" />
                  <path d="M13 5.5L16 8.5l-3 3" />
                </svg>
              </button>
              <button
                aria-label="Delete selection"
                disabled={!hasSelection}
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      key: "Backspace",
                      bubbles: true,
                    }),
                  )
                }
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${hasSelection ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 5.5h15" />
                  <path d="M7.5 5.5V3.5h5v2" />
                  <path d="M5 5.5l1 13h8l1-13" />
                  <path d="M8.5 9v6" />
                  <path d="M11.5 9v6" />
                </svg>
              </button>
            </div>
          )}
          <nav
            aria-label="Drawing tools"
            className={`fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-1 touch-toolbar ${isTablet ? "top-4" : "bottom-4"}`}
          >
            {/* Undo / Redo / Delete — mobile only: above top-right of toolbar. Nav is z-40 so menu (z-50) paints on top. */}
            {!isTablet && (
              <div className="absolute right-1 bottom-full mb-1 flex items-center gap-0.5">
                <button
                  aria-label="Undo"
                  disabled={!canUndo}
                  onClick={() =>
                    window.dispatchEvent(new Event("drawtool:undo"))
                  }
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canUndo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 8.5H12C14.5 8.5 16.5 10.5 16.5 13S14.5 17.5 12 17.5H7" />
                    <path d="M7 5.5L4 8.5l3 3" />
                  </svg>
                </button>
                <button
                  aria-label="Redo"
                  disabled={!canRedo}
                  onClick={() =>
                    window.dispatchEvent(new Event("drawtool:redo"))
                  }
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canRedo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 8.5H8C5.5 8.5 3.5 10.5 3.5 13S5.5 17.5 8 17.5H13" />
                    <path d="M13 5.5L16 8.5l-3 3" />
                  </svg>
                </button>
                <button
                  aria-label="Delete selection"
                  disabled={!hasSelection}
                  onClick={() =>
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        key: "Backspace",
                        bubbles: true,
                      }),
                    )
                  }
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${hasSelection ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 5.5h15" />
                    <path d="M7.5 5.5V3.5h5v2" />
                    <path d="M5 5.5l1 13h8l1-13" />
                    <path d="M8.5 9v6" />
                    <path d="M11.5 9v6" />
                  </svg>
                </button>
              </div>
            )}
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
                    aria-pressed={
                      touchTool === t.id ||
                      (t.id === "highlight" &&
                        (touchTool === "laser" || touchTool === "spray"))
                    }
                    onClick={() => {
                      window.dispatchEvent(new Event("drawtool:close-menu"));
                      if (shapeLongPressRef.current) {
                        clearTimeout(shapeLongPressRef.current);
                        shapeLongPressRef.current = null;
                      }
                      if (thicknessLongPressRef.current) {
                        clearTimeout(thicknessLongPressRef.current);
                        thicknessLongPressRef.current = null;
                      }
                      if (highlightLongPressRef.current) {
                        clearTimeout(highlightLongPressRef.current);
                        highlightLongPressRef.current = null;
                      }
                      if (longPressFiredRef.current) {
                        longPressFiredRef.current = false;
                        return;
                      }
                      if (
                        !showShapePicker &&
                        !showThicknessPicker &&
                        !showHighlightPicker
                      ) {
                        if (t.id === "hand") {
                          const now = Date.now();
                          if (now - handLastTapRef.current < 350) {
                            resetView();
                            handLastTapRef.current = 0;
                          } else {
                            handLastTapRef.current = now;
                            setTouchTool("hand");
                          }
                        } else {
                          setTouchTool(
                            t.id === "highlight" ? lastMarkTool : t.id,
                          );
                        }
                      }
                      setShowShapePicker(false);
                      setShowThicknessPicker(null);
                      setShowHighlightPicker(false);
                    }}
                    onPointerDown={
                      hasLongPress
                        ? () => {
                            if (t.id === "shape") {
                              shapeLongPressRef.current = setTimeout(() => {
                                setShowShapePicker(true);
                                setShowThicknessPicker(null);
                                setShowHighlightPicker(false);
                                setTouchTool(t.id);
                                shapeLongPressRef.current = null;
                                longPressFiredRef.current = true;
                              }, 400);
                            } else if (t.id === "highlight") {
                              highlightLongPressRef.current = setTimeout(() => {
                                setShowHighlightPicker(true);
                                setShowThicknessPicker(null);
                                setShowShapePicker(false);
                                highlightLongPressRef.current = null;
                                longPressFiredRef.current = true;
                              }, 400);
                            } else if (
                              t.id === "draw" ||
                              t.id === "dashed" ||
                              t.id === "line"
                            ) {
                              thicknessLongPressRef.current = setTimeout(() => {
                                setShowThicknessPicker(
                                  t.id as "draw" | "dashed" | "line",
                                );
                                setShowShapePicker(false);
                                setShowHighlightPicker(false);
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
                      if (highlightLongPressRef.current) {
                        clearTimeout(highlightLongPressRef.current);
                        highlightLongPressRef.current = null;
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
                      if (highlightLongPressRef.current) {
                        clearTimeout(highlightLongPressRef.current);
                        highlightLongPressRef.current = null;
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-2.5 sm:px-3 sm:py-3 rounded text-xs transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      touchTool === t.id ||
                      (t.id === "highlight" &&
                        (touchTool === "laser" || touchTool === "spray"))
                        ? isDark
                          ? "bg-white/20 text-white"
                          : "bg-black/20 text-black"
                        : isDark
                          ? "text-white/60 hover:bg-white/10"
                          : "text-black/60 hover:bg-black/10"
                    }`}
                  >
                    {t.id === "highlight" && lastMarkTool === "laser" ? (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="3"
                          fill="#ff3030"
                          fillOpacity="0.9"
                        />
                        <circle
                          cx="8"
                          cy="8"
                          r="5.5"
                          stroke="#ff3030"
                          strokeWidth="1"
                          strokeOpacity="0.4"
                        />
                      </svg>
                    ) : t.id === "highlight" && lastMarkTool === "spray" ? (
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
                        <circle
                          cx="1.5"
                          cy="3.5"
                          r="0.85"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="0.5"
                          cy="6.5"
                          r="0.75"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="1.5"
                          cy="9.5"
                          r="0.75"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <g transform="rotate(-12 9.5 10)">
                          <rect x="6" y="7" width="7" height="8.5" rx="1.5" />
                          <rect x="7.5" y="4" width="4" height="3" rx="0.5" />
                          <line x1="7.5" y1="5.5" x2="5" y2="5.5" />
                        </g>
                      </svg>
                    ) : (
                      t.icon
                    )}
                  </button>
                );
              })}
              {showThicknessPicker && (
                <div
                  className={`absolute left-0 right-0 p-3 rounded-lg border backdrop-blur-sm ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
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
                      "#ff7f50",
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
                className={`absolute flex flex-wrap gap-1 p-1 rounded-lg border backdrop-blur-sm ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
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
                <div
                  className="flex w-full gap-1 pb-1 mb-0.5"
                  style={{
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                  }}
                >
                  <button
                    aria-label={`Fill: ${settings.shapeFillEnabled ? settings.shapeFill : "none"}`}
                    onClick={() =>
                      updateSettings({
                        shapeFillEnabled: !settings.shapeFillEnabled,
                      })
                    }
                    className={`flex-1 flex items-center justify-center p-2 rounded transition-colors ${
                      settings.shapeFillEnabled
                        ? isDark
                          ? "bg-white/20"
                          : "bg-black/20"
                        : isDark
                          ? "hover:bg-white/10"
                          : "hover:bg-black/10"
                    }`}
                  >
                    {settings.shapeFill === "solid" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={settings.lineColor}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        opacity={settings.shapeFillEnabled ? 1 : 0.35}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          fill={settings.lineColor}
                        />
                      </svg>
                    )}
                    {settings.shapeFill === "dots" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={settings.lineColor}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        opacity={settings.shapeFillEnabled ? 1 : 0.35}
                      >
                        <rect x="2" y="2" width="12" height="12" rx="1.5" />
                        <circle
                          cx="6"
                          cy="6.5"
                          r="1.2"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="6.5"
                          r="1.2"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="6"
                          cy="10.5"
                          r="1.2"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="10.5"
                          r="1.2"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                      </svg>
                    )}
                    {settings.shapeFill === "hatch" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={settings.lineColor}
                        strokeLinejoin="round"
                        opacity={settings.shapeFillEnabled ? 1 : 0.35}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          strokeWidth="1.5"
                        />
                        <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                        <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.1" />
                        <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                      </svg>
                    )}
                    {settings.shapeFill === "crosshatch" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={settings.lineColor}
                        strokeLinejoin="round"
                        opacity={settings.shapeFillEnabled ? 1 : 0.35}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          strokeWidth="1.5"
                        />
                        <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                        <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                        <line x1="9" y1="2" x2="2" y2="9" strokeWidth="1.1" />
                        <line x1="14" y1="7" x2="7" y2="14" strokeWidth="1.1" />
                      </svg>
                    )}
                  </button>
                  <button
                    aria-label="Dashed shape"
                    aria-pressed={settings.shapeDashed}
                    onClick={() =>
                      updateSettings({ shapeDashed: !settings.shapeDashed })
                    }
                    className={`flex-1 flex items-center justify-center p-2 rounded transition-colors ${
                      settings.shapeDashed
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
                      strokeDasharray="3.5 2.5"
                      opacity={settings.shapeDashed ? 1 : 0.35}
                    >
                      <rect x="2" y="2" width="12" height="12" rx="1.5" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 w-full">
                  {SHAPES.map((shape) => (
                    <button
                      key={shape}
                      aria-label={
                        shape.charAt(0).toUpperCase() + shape.slice(1)
                      }
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
                        {shape === "cloud" && (
                          <path d="M 4.8,12 H 11.2 C 12.9,12 14.3,10.8 14.3,9.3 C 14.3,7.9 13.3,6.9 12,6.7 C 11.6,5.2 10.3,4.1 8.6,4.1 C 7.1,4.1 5.9,5 5.3,6.3 C 3.7,6.5 2.5,7.7 2.5,9.2 C 2.5,10.8 3.7,12 4.8,12 Z" />
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showHighlightPicker && (
              <div
                className={`absolute p-1.5 rounded-lg border backdrop-blur-sm flex gap-1 ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
                style={{
                  background: isDark
                    ? "rgba(0,0,0,0.85)"
                    : "rgba(255,255,255,0.85)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.15)",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(["highlight", "laser", "spray"] as const).map((tool) => (
                  <button
                    key={tool}
                    aria-label={
                      tool === "highlight"
                        ? "Mark"
                        : tool === "laser"
                          ? "Laser"
                          : "Spray"
                    }
                    aria-pressed={touchTool === tool}
                    onClick={() => {
                      setTouchTool(tool);
                      setLastMarkTool(tool);
                      setShowHighlightPicker(false);
                    }}
                    className={`flex items-center justify-center px-3 py-2.5 rounded transition-colors ${
                      touchTool === tool
                        ? isDark
                          ? "bg-white/20 text-white"
                          : "bg-black/20 text-black"
                        : isDark
                          ? "text-white/60 hover:bg-white/10"
                          : "text-black/60 hover:bg-black/10"
                    }`}
                  >
                    {tool === "highlight" && (
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
                    )}
                    {tool === "laser" && (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="3"
                          fill="#ff3030"
                          fillOpacity="0.9"
                        />
                        <circle
                          cx="8"
                          cy="8"
                          r="5.5"
                          stroke="#ff3030"
                          strokeWidth="1"
                          strokeOpacity="0.4"
                        />
                      </svg>
                    )}
                    {tool === "spray" && (
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
                        <circle
                          cx="1.5"
                          cy="3.5"
                          r="0.85"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="0.5"
                          cy="6.5"
                          r="0.75"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <circle
                          cx="1.5"
                          cy="9.5"
                          r="0.75"
                          fill={settings.lineColor}
                          stroke="none"
                        />
                        <g transform="rotate(-12 9.5 10)">
                          <rect x="6" y="7" width="7" height="8.5" rx="1.5" />
                          <rect x="7.5" y="4" width="4" height="3" rx="0.5" />
                          <line x1="7.5" y1="5.5" x2="5" y2="5.5" />
                        </g>
                      </svg>
                    )}
                  </button>
                ))}
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
        style={{ pointerEvents: isEditingName ? "auto" : "none" }}
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
        {!hasTouch &&
          (isEditingName ? (
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
          ))}
      </div>
      {newCanvasBlurred && newCanvasDialogOpen && (
        <div className="fixed inset-0 z-40 backdrop-blur-xl pointer-events-none" />
      )}
      {newCanvasDialogOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center z-50"
        >
          <div
            className={`px-8 py-5 rounded-lg border backdrop-blur-sm text-center max-w-xs ${isDark ? "bg-black/80 border-white/15" : "bg-white/80 border-black/15"}`}
          >
            <div
              className={`text-sm font-medium mb-1 ${isDark ? "text-white/80" : "text-black/80"}`}
            >
              All canvases are in use
            </div>
            <div
              className={`text-xs mb-3 ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              This canvas has content. Open it as-is or clear it first.
            </div>
            <div className="flex gap-2 mt-3 justify-center">
              <button
                aria-label={newCanvasBlurred ? "Show canvas" : "Hide canvas"}
                onClick={() => setNewCanvasBlurred((b) => !b)}
                className={`px-2.5 py-1.5 rounded transition-colors ${isDark ? "text-white/50 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/50 hover:text-black bg-black/5 hover:bg-black/10"}`}
              >
                {newCanvasBlurred ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 8C1 8 3.5 3 8 3s7 5 7 5-2.5 5-7 5S1 8 1 8z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 8C1 8 3.5 3 8 3s7 5 7 5-2.5 5-7 5S1 8 1 8z" />
                    <circle cx="8" cy="8" r="2" />
                    <line x1="2" y1="2" x2="14" y2="14" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => {
                  setNewCanvasDialogOpen(false);
                  setNewCanvasBlurred(false);
                }}
                className={`flex-1 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
              >
                Open anyway
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new Event("drawtool:clear"));
                  window.dispatchEvent(new Event("drawtool:reset-view"));
                  setZoom(1);
                  setNewCanvasDialogOpen(false);
                  setNewCanvasBlurred(false);
                }}
                className={`flex-1 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${isDark ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20" : "text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20"}`}
              >
                Clear &amp; open
              </button>
            </div>
          </div>
        </div>
      )}
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
                  ⇧ + drag
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
                  {isMac ? "Ctrl" : `${alt} + ⇧`} + drag
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
      {toast?.type === "challenge" && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-14 z-40 flex items-center gap-2.5 px-3 py-2 rounded-xl pointer-events-none ${toastFading ? "animate-toast-out" : "animate-toast-in"}`}
          style={{
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            boxShadow: "0 6px 24px rgba(34,197,94,0.45), 0 2px 8px rgba(0,0,0,0.2)",
            color: "#fff",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4,12 9,18 20,6" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.75, letterSpacing: "0.07em", textTransform: "uppercase", lineHeight: 1 }}>Challenge complete</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{toast.message}</div>
          </div>
        </div>
      )}
      {toast && toast.type !== "challenge" && (
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
          ) : toast.type === "corners" ? (
            <>
              Edges
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx={toast.corners === "rounded" ? 3 : 0}
                />
              </svg>
            </>
          ) : toast.type === "text" ? (
            toast.message
          ) : toast.type === "fill" ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeLinejoin="round"
            >
              {toast.fill === "solid" && (
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx="1.5"
                  strokeWidth="1.5"
                  fill="currentColor"
                  fillOpacity="0.35"
                />
              )}
              {toast.fill === "dots" && (
                <>
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="1.5"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="6"
                    cy="6.5"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="10"
                    cy="6.5"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="6"
                    cy="10.5"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="10"
                    cy="10.5"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                  />
                </>
              )}
              {toast.fill === "hatch" && (
                <>
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="1.5"
                    strokeWidth="1.5"
                  />
                  <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                  <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.1" />
                  <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                </>
              )}
              {toast.fill === "crosshatch" && (
                <>
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="1.5"
                    strokeWidth="1.5"
                  />
                  <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                  <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                  <line x1="9" y1="2" x2="2" y2="9" strokeWidth="1.1" />
                  <line x1="14" y1="7" x2="7" y2="14" strokeWidth="1.1" />
                </>
              )}
            </svg>
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
              {toast.shape === "cloud" && (
                <path d="M 4.8,12 H 11.2 C 12.9,12 14.3,10.8 14.3,9.3 C 14.3,7.9 13.3,6.9 12,6.7 C 11.6,5.2 10.3,4.1 8.6,4.1 C 7.1,4.1 5.9,5 5.3,6.3 C 3.7,6.5 2.5,7.7 2.5,9.2 C 2.5,10.8 3.7,12 4.8,12 Z" />
              )}
            </svg>
          )}
        </div>
      )}
      {trainingFlash && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-training-flash"
          style={{ background: isDark ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.82)" }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ fontFamily: "Pacifico, cursive", fontSize: 32 }}>
            {([
              { letter: "d", color: "#3b82f6", rotate: -6 },
              { letter: "r", color: "#ef4444", rotate: 3 },
              { letter: "a", color: "#22c55e", rotate: -4 },
              { letter: "w", color: "#eab308", rotate: 5 },
              { letter: "t", color: "#ec4899", rotate: -3 },
              { letter: "o", color: "#f97316", rotate: 4 },
              { letter: "o", color: "#8b5cf6", rotate: -5 },
              { letter: "l", color: "#06b6d4", rotate: 3 },
            ] as { letter: string; color: string; rotate: number }[]).map((l, i) => (
              <span key={i} style={{ display: "inline-block", marginLeft: i === 0 ? 0 : 4, transform: `rotate(${l.rotate}deg)` }}>
                <span style={{ color: l.color, display: "inline-block", textShadow: isDark ? `0 0 16px ${l.color}66` : `2px 2px 0 ${l.color}22` }}>
                  {l.letter}
                </span>
              </span>
            ))}
          </div>
          <div className="text-sm font-mono tracking-widest uppercase" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)", letterSpacing: "0.25em" }}>
            training mode
          </div>
        </div>
      )}
      {showTraining && (
        <div
          className="fixed top-2 left-1/2 -translate-x-1/2 z-30 rounded-full border backdrop-blur-md flex items-center"
          style={{
            background: isDark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
          }}
        >
          <div className="px-3 py-1 flex items-center pointer-events-none" style={{ fontFamily: "Pacifico, cursive", fontSize: 13 }}>
            {([
              { letter: "d", color: "#3b82f6", rotate: -6 },
              { letter: "r", color: "#ef4444", rotate: 3 },
              { letter: "a", color: "#22c55e", rotate: -4 },
              { letter: "w", color: "#eab308", rotate: 5 },
              { letter: "t", color: "#ec4899", rotate: -3 },
              { letter: "o", color: "#f97316", rotate: 4 },
              { letter: "o", color: "#8b5cf6", rotate: -5 },
              { letter: "l", color: "#06b6d4", rotate: 3 },
            ] as { letter: string; color: string; rotate: number }[]).map((l, i) => (
              <span key={i} style={{ display: "inline-block", marginLeft: i === 0 ? 0 : 2, transform: `rotate(${l.rotate}deg)` }}>
                <span style={{ color: l.color, display: "inline-block", textShadow: isDark ? `0 0 8px ${l.color}44` : `1px 1px 0 ${l.color}22` }}>
                  {l.letter}
                </span>
              </span>
            ))}
            <span className="ml-2 text-[11px]" style={{ fontFamily: "ui-monospace, monospace", color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>training mode</span>
          </div>
          <div className="self-stretch w-px" style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }} />
          <button
            onClick={() => { history.pushState(null, "", "/"); setShowTraining(false); }}
            className="px-3 py-1 text-[11px] rounded-r-full transition-colors"
            style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
          >
            Exit
          </button>
        </div>
      )}
      {showTraining && (
        <Training
          settings={settings}
          isDark={isDark}
          hasTouch={hasTouch}
          onExit={() => {
            history.pushState(null, "", "/");
            setShowTraining(false);
          }}
        />
      )}
      {showTrainingNudge && !showTraining && (
        <div
          className={`fixed ${hasTouch ? "bottom-24" : "bottom-4"} right-4 z-30 w-64 rounded-xl border backdrop-blur-md shadow-lg overflow-hidden animate-toast-in`}
          style={{
            background: isDark ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.92)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
          }}
        >
          {/* gradient top bar */}
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, #3b82f6, #ec4899)" }} />
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center" style={{ fontFamily: "Pacifico, cursive", fontSize: 13 }}>
                {([
                  { letter: "d", color: "#3b82f6", rotate: -6 },
                  { letter: "r", color: "#ef4444", rotate: 3 },
                  { letter: "a", color: "#22c55e", rotate: -4 },
                  { letter: "w", color: "#eab308", rotate: 5 },
                  { letter: "t", color: "#ec4899", rotate: -3 },
                  { letter: "o", color: "#f97316", rotate: 4 },
                  { letter: "o", color: "#8b5cf6", rotate: -5 },
                  { letter: "l", color: "#06b6d4", rotate: 3 },
                ] as { letter: string; color: string; rotate: number }[]).map((l, i) => (
                  <span key={i} style={{ display: "inline-block", marginLeft: i === 0 ? 0 : 2, transform: `rotate(${l.rotate}deg)` }}>
                    <span style={{ color: l.color, display: "inline-block", textShadow: isDark ? `0 0 8px ${l.color}44` : `1px 1px 0 ${l.color}22` }}>{l.letter}</span>
                  </span>
                ))}
                <span className="text-[11px] font-mono ml-1.5" style={{ fontFamily: "ui-monospace, monospace", color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>training</span>
              </div>
              <button
                onClick={() => dismissNudge(true)}
                className="shrink-0 mt-0.5 transition-opacity opacity-30 hover:opacity-60"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}>
              Learn all the tools and shortcuts with step-by-step challenges.
            </p>
            <button
              onClick={() => {
                dismissNudge(true);
                openTraining();
              }}
              className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: "linear-gradient(90deg, #3b82f620, #ec489920)", color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)", border: "1px solid #3b82f630" }}
            >
              Start training →
            </button>
          </div>
        </div>
      )}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Load canvas data"
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{
            background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
          }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            className={`flex flex-col gap-4 p-6 rounded-xl border backdrop-blur-sm ${isDark ? "bg-black/80 border-white/15" : "bg-white/90 border-black/15"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`text-sm font-medium ${isDark ? "text-white/80" : "text-black/80"}`}
            >
              Load canvas data
            </div>
            {/* Drop zone */}
            <div
              className={`flex flex-col items-center gap-3 px-16 py-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors select-none`}
              style={{
                borderColor: dropZoneActive
                  ? isDark
                    ? "rgba(255,255,255,0.6)"
                    : "rgba(0,0,0,0.5)"
                  : isDark
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(0,0,0,0.15)",
                background: dropZoneActive
                  ? isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)"
                  : "transparent",
              }}
              onClick={() => importFileRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                dropZoneCounterRef.current++;
                setDropZoneActive(true);
              }}
              onDragLeave={() => {
                if (--dropZoneCounterRef.current === 0)
                  setDropZoneActive(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropZoneCounterRef.current = 0;
                setDropZoneActive(false);
                const file = e.dataTransfer.files[0];
                if (file) {
                  setShowImportModal(false);
                  processImportFile(file);
                }
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: dropZoneActive ? 0.9 : 0.4 }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="relative text-sm whitespace-nowrap">
                {/* Invisible longest string holds the width */}
                <span className="invisible select-none">
                  Drop a JSON file here
                </span>
                <span
                  className={`absolute inset-0 text-center transition-opacity ${isDark ? "text-white/70" : "text-black/60"}`}
                >
                  {dropZoneActive ? "Release to load" : "Drop a JSON file here"}
                </span>
              </span>
              <span
                className={`text-xs ${isDark ? "text-white/30" : "text-black/30"}`}
              >
                or click to browse
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
