import {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import Canvas from "./components/Canvas";
import DrawzillaLogo from "./components/DrawzillaLogo";
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

import {
  isDarkTheme,
  getBackgroundColor,
  CONFIRM_CLEAR_STROKE_THRESHOLD,
  getImageDataUrlFromIdb,
  storeImage,
} from "./canvas/canvasUtils";
import { drawWatermark } from "./canvas/watermark";
import { getPanelBackground } from "./canvas/rendering";
import {
  loadStrokes,
  saveStrokes,
  loadView,
  saveView,
  validateStrokesFile,
  validateWorkspaceFile,
  strokesKey,
  loadStash,
  saveStash,
  reorderCanvases,
} from "./canvas/storage";
import type { StashItem, Stroke } from "./canvas/types";
import StashPanel from "./components/StashPanel";
import SelectControls, {
  COMMON_ACTIONS,
  DRAWING_ACTIONS,
  TEXT_ACTIONS,
  DANGER_ACTION,
  COMBINE_ACTION,
  UNCOMBINE_ACTION,
  kd as selectKd,
  type Action as SelectAction,
} from "./components/SelectControls";
import MigrationModal from "./components/MigrationModal";
import WorkspaceSwitcherModal from "./components/WorkspaceSwitcherModal";
import { useMigration } from "./hooks/useMigration";
import { useCloudCanvas } from "./hooks/useCloudCanvas";
import { useUserPlan, openBillingPortal } from "./hooks/useUserPlan";
import { useCloudStash } from "./hooks/useCloudStash";
import { useUser, useAuth } from "@clerk/clerk-react";
import { CANVAS_LIMIT } from "./config";
import { usePreferencesSync } from "./hooks/usePreferencesSync";
import {
  Layers,
  Hand,
  Pipette,
  Pencil,
  Square,
  Circle,
  Triangle,
  Diamond,
  Pentagon,
  Hexagon,
  Star,
  ArrowRight,
  Cloud,
  Type,
  Undo2,
  Redo2,
  Trash2,
} from "lucide-react";

const CLOUD_ENABLED = true; // set false to hide login/cloud features

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
// Cloud users need async handling — flag persists until useCloudCanvas picks it up
export let _newRouteForCloud = window.location.pathname === "/new";

if (window.location.pathname === "/new") {
  window.history.replaceState(null, "", "/");
  const counts = Array.from({ length: CANVAS_LIMIT }, (_, i) => {
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

function buildExportFilename(name: string, index: number): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}-${index}` : `canvas-${index}`;
}

export default function App() {
  const [settings, updateSettings] = useSettings();
  usePreferencesSync(settings, updateSettings);

  const [zoom, setZoom] = useState(() => {
    try {
      // Cloud users always save their view to slot 1
      const cloudId = localStorage.getItem("drawtool-cloud-active-canvas");
      const canvasIndex = cloudId
        ? 1
        : (() => {
            const stored = localStorage.getItem("drawtool-active-canvas");
            return stored ? parseInt(stored, 10) : 1;
          })();
      const raw = localStorage.getItem(`drawtool-view-${canvasIndex}`);
      if (raw) return (JSON.parse(raw) as { scale?: number }).scale ?? 1;
    } catch {}
    return 1;
  });
  const [touchTool, setTouchTool] = useState<TouchTool>(() => {
    const saved = localStorage.getItem("drawtool-touch-tool");
    const valid: TouchTool[] = ["draw", "dashed", "line", "erase", "hand", "shape", "highlight", "text", "select"];
    const resolved = (valid.includes(saved as TouchTool) ? saved : "draw") as TouchTool;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return (!isTouch && resolved === "select") ? "draw" : resolved;
  });
  const [hasTouch] = useState(
    () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
  );
  useEffect(() => {
    localStorage.setItem("drawtool-touch-tool", touchTool);
  }, [touchTool]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const showHoldHint = true;
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
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [selectHintVisible, setSelectHintVisible] = useState(false);
  const selectHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const exportFormatRef = useRef(settings.exportFormat);
  const exportTransparentBgRef = useRef(settings.exportTransparentBg);
  const exportIncludeImagesRef = useRef(settings.exportIncludeImages);
  exportFormatRef.current = settings.exportFormat;
  exportTransparentBgRef.current = settings.exportTransparentBg;
  exportIncludeImagesRef.current = settings.exportIncludeImages;
  const canvasNameRef = useRef(canvasName);
  const activeCanvasRef = useRef(activeCanvas);
  const cloudActiveIdRef = useRef<string | null>(null);
  const cloudCanvasesRef = useRef<Array<{ position: number; name: string }>>([]);
  canvasNameRef.current = canvasName;
  activeCanvasRef.current = activeCanvas;
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
  const [storageQuotaCanvases, setStorageQuotaCanvases] = useState<Set<number>>(
    () => new Set(),
  );
  const toastFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [showSelectPicker, setShowSelectPicker] = useState(false);
  const [lastMarkTool, setLastMarkTool] = useState<
    "highlight" | "laser" | "spray"
  >("highlight");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  const [selectionIsCombined, setSelectionIsCombined] = useState(false);
  const [selectionIsText, setSelectionIsText] = useState(false);
  const [selectionIsLocked, setSelectionIsLocked] = useState(false);
  const [, setMenuOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768);
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1280);
  useEffect(() => {
    const onResize = () => {
      setIsTablet(window.innerWidth >= 768);
      setIsWide(window.innerWidth >= 1280);
    };
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
  const textLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const handLastTapRef = useRef<number>(0);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const drawButtonRef = useRef<HTMLButtonElement>(null);
  const dashedButtonRef = useRef<HTMLButtonElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Track last 2 used colors for swap (`,` shortcut)
  const usedColorARef = useRef(settings.lineColor); // most recently used
  const usedColorBRef = useRef(settings.lineColor); // previously used

  // Apply body styles based on theme + notify ClerkRoot so sign-in modal updates live
  useEffect(() => {
    const isDark = isDarkTheme(settings.theme);
    const bg = getBackgroundColor(settings.theme);
    document.body.style.background = bg;
    document.documentElement.style.background = bg;
    document.body.style.color = isDark
      ? "rgba(255,255,255,0.8)"
      : "rgba(0,0,0,0.8)";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    window.dispatchEvent(
      new CustomEvent("drawtool:themechange", { detail: settings.theme }),
    );
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
    if (showTraining || showOnboarding) return;
    const count = parseInt(localStorage.getItem(NUDGE_KEY) ?? "0", 10);
    if (count >= MAX_NUDGES) return;
    const delay = 10000 + Math.random() * 20000; // 10–30s
    const t = setTimeout(() => {
      setShowTrainingNudge(true);
      localStorage.setItem(NUDGE_KEY, String(count + 1));
    }, delay);
    return () => clearTimeout(t);
  }, [showTraining, showOnboarding]);

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
      if (detail.count > CONFIRM_CLEAR_STROKE_THRESHOLD) {
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

  const exportPng = useCallback(async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const filename = buildExportFilename(
      canvasNameRef.current,
      activeCanvasRef.current,
    );
    const savePng = (blob: Blob) => {
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {
          // User dismissed or share failed — fall back to download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    };
    if (isProRef.current) {
      canvas.toBlob((blob) => { if (blob) savePng(blob); });
      return;
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    await drawWatermark(
      ctx,
      offscreen.width,
      offscreen.height,
      window.devicePixelRatio || 1,
    );
    offscreen.toBlob((blob) => { if (blob) savePng(blob); });
  }, []);

  const importFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<"canvas" | "workspace">(
    "canvas",
  );
  const [pendingWorkspaceImport, setPendingWorkspaceImport] = useState<{
    file: File;
    total: number;
  } | null>(null);
  // Refs so processWorkspaceFile (defined early) can read plan data at call time
  const canvasLimitImportRef = useRef(3);
  const [showStash, setShowStash] = useState(false);
  const [stashItems, setStashItems] = useState<StashItem[]>(() => loadStash());
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const dropZoneCounterRef = useRef(0);

  const exportData = useCallback(async () => {
    const strokes = loadStrokes(activeCanvas);
    const name = canvasNameRef.current || undefined;
    let images: Record<string, string> | undefined;
    if (exportIncludeImagesRef.current) {
      const ids = [
        ...new Set(strokes.map((s) => s.imageId).filter(Boolean) as string[]),
      ];
      if (ids.length > 0) {
        images = {};
        for (const id of ids) {
          const url = await getImageDataUrlFromIdb(id);
          if (url) images[id] = url;
        }
      }
    }
    const file = {
      version: 1,
      strokes,
      ...(name ? { name } : {}),
      ...(images ? { images } : {}),
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${buildExportFilename(canvasName, activeCanvas)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      { type: "text", message: `Exported canvas ${activeCanvas}` },
      1500,
    );
  }, [activeCanvas, canvasName, showToast]);

  const processImportFile = useCallback(
    (file: File) => {
      file.text().then((text) => {
        try {
          const { strokes, name, images } = validateStrokesFile(
            JSON.parse(text),
          );
          const targetSlot = cloudActiveIdRef.current ? 1 : activeCanvas;
          saveStrokes(strokes, targetSlot);
          if (name !== undefined) {
            if (!cloudActiveIdRef.current)
              localStorage.setItem(
                `drawtool-canvas-name-${activeCanvas}`,
                name,
              );
            setCanvasName(name);
          }
          const imageEntries = images ? Object.entries(images) : [];
          const restoreAndDispatch = () => {
            window.dispatchEvent(
              new CustomEvent("drawtool:import-strokes", { detail: strokes }),
            );
            window.dispatchEvent(new Event("drawtool:center-view"));
            showToast(
              {
                type: "text",
                message: `Imported ${strokes.length} stroke${strokes.length !== 1 ? "s" : ""}`,
              },
              1500,
            );
          };
          if (imageEntries.length > 0) {
            Promise.all(
              imageEntries.map(([id, dataUrl]) => storeImage(id, dataUrl)),
            ).then(restoreAndDispatch);
          } else {
            restoreAndDispatch();
          }
        } catch (err) {
          console.error("Canvas import error:", err);
          showToast(
            {
              type: "text",
              message: `Import failed: ${(err as Error).message}`,
            },
            5000,
          );
        }
      });
    },
    [activeCanvas, showToast],
  );

  const exportWorkspaceData = useCallback(async () => {
    const canvasEntries = await Promise.all(
      Array.from({ length: 9 }, async (_, i) => {
        const index = i + 1;
        const strokes = loadStrokes(index);
        const view = loadView(index);
        const name =
          localStorage.getItem(`drawtool-canvas-name-${index}`) || undefined;
        let images: Record<string, string> | undefined;
        if (exportIncludeImagesRef.current) {
          const ids = [
            ...new Set(
              strokes.map((s) => s.imageId).filter(Boolean) as string[],
            ),
          ];
          if (ids.length > 0) {
            images = {};
            for (const id of ids) {
              const dataUrl = await getImageDataUrlFromIdb(id);
              if (dataUrl) images[id] = dataUrl;
            }
          }
        }
        return {
          index,
          strokes,
          view,
          ...(name ? { name } : {}),
          ...(images ? { images } : {}),
        };
      }),
    );
    const canvases = canvasEntries.filter((c) => c.strokes.length > 0);
    const file = { version: 1, type: "workspace", canvases };
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      {
        type: "text",
        message: `Exported workspace (${canvases.length} canvas${canvases.length !== 1 ? "es" : ""})`,
      },
      1500,
    );
  }, [showToast]);

  const processWorkspaceFile = useCallback(
    (file: File, confirmedLimit?: number) => {
      file.text().then((text) => {
        try {
          let canvases = validateWorkspaceFile(JSON.parse(text));
          // Non-Pro users: intercept if workspace exceeds their canvas limit
          if (
            confirmedLimit === undefined &&
            !isProRef.current &&
            canvases.length > canvasLimitImportRef.current
          ) {
            setPendingWorkspaceImport({ file, total: canvases.length });
            return;
          }
          if (confirmedLimit !== undefined)
            canvases = canvases.slice(0, confirmedLimit);
          const allImageEntries: [string, string][] = [];
          for (const { index, strokes, view, name, images } of canvases) {
            saveStrokes(strokes, index);
            if (view) saveView(view, index);
            if (name !== undefined)
              localStorage.setItem(`drawtool-canvas-name-${index}`, name);
            else localStorage.removeItem(`drawtool-canvas-name-${index}`);
            if (images) allImageEntries.push(...Object.entries(images));
          }
          const activeNameAfterImport =
            localStorage.getItem(`drawtool-canvas-name-${activeCanvas}`) ?? "";
          setCanvasName(activeNameAfterImport);
          const dispatchWorkspace = () => {
            window.dispatchEvent(
              new CustomEvent("drawtool:import-strokes", {
                detail: loadStrokes(activeCanvas),
              }),
            );
            showToast(
              {
                type: "text",
                message: `Imported workspace (${canvases.length} canvas${canvases.length !== 1 ? "es" : ""})`,
              },
              1500,
            );
          };
          if (allImageEntries.length > 0) {
            Promise.all(
              allImageEntries.map(([id, dataUrl]) => storeImage(id, dataUrl)),
            ).then(dispatchWorkspace);
          } else {
            dispatchWorkspace();
          }
        } catch (err) {
          console.error("Workspace import error:", err);
          showToast(
            {
              type: "text",
              message: `Import failed: ${(err as Error).message}`,
            },
            5000,
          );
        }
      });
    },
    [activeCanvas, showToast],
  );

  const importData = useCallback(() => {
    setImportMode("canvas");
    setShowImportModal(true);
  }, []);

  const importWorkspaceData = useCallback(() => {
    setImportMode("workspace");
    setShowImportModal(true);
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setShowImportModal(false);
      if (importMode === "workspace") processWorkspaceFile(file);
      else processImportFile(file);
    },
    [importMode, processImportFile, processWorkspaceFile],
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
    const onToggleStash = () =>
      setShowStash((p) => {
        if (!p) window.dispatchEvent(new Event("drawtool:close-menu"));
        return !p;
      });
    const onSaveToStashResult = (e: Event) => {
      const strokes = (e as CustomEvent<Stroke[]>).detail;
      if (!strokes.length) return;
      setStashItems((prev) => {
        const item: StashItem = {
          id: crypto.randomUUID(),
          name: `Item ${prev.length + 1}`,
          createdAt: Date.now(),
          strokes: JSON.parse(JSON.stringify(strokes)),
          savedDark: isDarkTheme(settingsRef.current.theme),
        };
        const next = [item, ...prev];
        saveStash(next);
        return next;
      });
      showToast({ type: "text", message: "Saved to stash" });
    };
    const onCloseStash = () => setShowStash(false);
    window.addEventListener("drawtool:toggle-stash", onToggleStash);
    window.addEventListener(
      "drawtool:save-to-stash-result",
      onSaveToStashResult,
    );
    window.addEventListener("drawtool:close-stash", onCloseStash);
    const onOpenImageInsert = () => imageFileRef.current?.click();
    window.addEventListener("drawtool:open-image-insert", onOpenImageInsert);
    return () => {
      window.removeEventListener("drawtool:toggle-stash", onToggleStash);
      window.removeEventListener(
        "drawtool:save-to-stash-result",
        onSaveToStashResult,
      );
      window.removeEventListener("drawtool:close-stash", onCloseStash);
      window.removeEventListener(
        "drawtool:open-image-insert",
        onOpenImageInsert,
      );
    };
  }, [showToast]);

  useEffect(() => {
    if (!showStash) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowStash(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [showStash]);

  useEffect(() => {
    const onState = (e: Event) => {
      const {
        canUndo,
        canRedo,
        hasSelection,
        selectionCount,
        selectionIsCombined,
        selectionIsText,
        selectionIsLocked,
      } = (e as CustomEvent).detail;
      setCanUndo(canUndo);
      setCanRedo(canRedo);
      setHasSelection(hasSelection);
      setSelectionCount(selectionCount ?? 0);
      setSelectionIsCombined(selectionIsCombined ?? false);
      setSelectionIsText(selectionIsText ?? false);
      setSelectionIsLocked(selectionIsLocked ?? false);
    };
    const onMenuState = (e: Event) => {
      const open = (e as CustomEvent).detail as boolean;
      setMenuOpen(open);
      if (open) {
        setShowShapePicker(false);
        setShowThicknessPicker(null);
        setShowHighlightPicker(false);
        setShowStash(false);
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
        // For cloud users, read name from cloud metadata to avoid a flash of stale/empty local name.
        // Sort by position so the lookup is robust even when positions have gaps/duplicates.
        const cloudMeta = cloudActiveIdRef.current
          ? ([...cloudCanvasesRef.current].sort((a, b) => a.position - b.position)[n - 1] ?? null)
          : null;
        setCanvasName(
          cloudMeta?.name ?? (localStorage.getItem(`drawtool-canvas-name-${n}`) ?? ""),
        );
        showToast({ type: "text", message: `Canvas ${n}` });
        cloudSwitchRef.current?.(n);
      }
    };
    const onFocusCanvasName = () => {
      setIsEditingName(true);
    };
    const onFindBlankCanvas = () => findBlankCanvasRef.current?.();
    window.addEventListener("drawtool:zoom", onZoom);
    window.addEventListener("drawtool:thickness", onThickness);
    window.addEventListener("drawtool:color-cycle", onColorCycle);
    window.addEventListener("drawtool:color-used", onColorUsed);
    window.addEventListener("drawtool:swap-color", onSwapColor);
    window.addEventListener("drawtool:request-clear", onRequestClear);
    window.addEventListener("drawtool:cycle-shape", onCycleShape);
    window.addEventListener("drawtool:cycle-shape-back", onCycleShapeBack);
    window.addEventListener("drawtool:switch-canvas", onSwitchCanvas);
    window.addEventListener("drawtool:find-blank-canvas", onFindBlankCanvas);
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
    const onSelectHeld = (e: Event) => {
      const { on } = (e as CustomEvent).detail as { on: boolean };
      if (on) {
        if (!selectHintTimerRef.current) {
          selectHintTimerRef.current = setTimeout(() => {
            selectHintTimerRef.current = null;
            setSelectHintVisible(true);
          }, 1200);
        }
      } else {
        if (selectHintTimerRef.current) {
          clearTimeout(selectHintTimerRef.current);
          selectHintTimerRef.current = null;
        }
        setSelectHintVisible(false);
      }
    };
    window.addEventListener("drawtool:select-held", onSelectHeld);
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "object" && detail.type === "toggle") {
        if (detail.label === "Select mode") {
          if (selectHintTimerRef.current) {
            clearTimeout(selectHintTimerRef.current);
            selectHintTimerRef.current = null;
          }
          setSelectHintVisible(detail.on);
        }
        showToast(
          { type: "toggle", label: detail.label, on: detail.on },
          detail.duration,
        );
        return;
      }
      const message =
        typeof detail === "object" ? detail.message : (detail as string);
      const duration = typeof detail === "object" ? detail.duration : undefined;
      const isChallenge = typeof detail === "object" && detail.challenge;
      showToast(
        { type: isChallenge ? "challenge" : "text", message },
        duration,
      );
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
    window.addEventListener("drawtool:export-data", exportData);
    window.addEventListener("drawtool:text-size", onTextSize);
    window.addEventListener("drawtool:font-family", onFontFamily);
    window.addEventListener("drawtool:set-color", onSetColor);
    window.addEventListener("drawtool:text-style-sync", onTextStyleSync);
    window.addEventListener("drawtool:toast", onToast);
    window.addEventListener("drawtool:cycle-theme", onCycleTheme);
    const onTextPlaced = () => {
      // Defer so this fires after any concurrent setTouchTool from a toolbar click,
      // ensuring the selection wins regardless of which triggered finishWriting first.
      if (hasTouch) setTimeout(() => setTouchTool("select"), 0);
    };
    window.addEventListener("drawtool:text-placed", onTextPlaced);
    const onStorageQuota = (e: Event) => {
      const idx = (e as CustomEvent).detail?.canvasIndex as number;
      setStorageQuotaCanvases((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    };
    const onStorageOk = (e: Event) => {
      const idx = (e as CustomEvent).detail?.canvasIndex as number;
      setStorageQuotaCanvases((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    };
    window.addEventListener("drawtool:storage-quota", onStorageQuota);
    window.addEventListener("drawtool:storage-ok", onStorageOk);
    return () => {
      window.removeEventListener("drawtool:select-held", onSelectHeld);
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
        "drawtool:find-blank-canvas",
        onFindBlankCanvas,
      );
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
      window.removeEventListener("drawtool:export-data", exportData);
      window.removeEventListener("drawtool:text-size", onTextSize);
      window.removeEventListener("drawtool:font-family", onFontFamily);
      window.removeEventListener("drawtool:set-color", onSetColor);
      window.removeEventListener("drawtool:text-style-sync", onTextStyleSync);
      window.removeEventListener("drawtool:toast", onToast);
      window.removeEventListener("drawtool:cycle-theme", onCycleTheme);
      window.removeEventListener("drawtool:text-placed", onTextPlaced);
      window.removeEventListener("drawtool:storage-quota", onStorageQuota);
      window.removeEventListener("drawtool:storage-ok", onStorageOk);
    };
  }, [
    updateSettings,
    requestClear,
    showToast,
    toggleFullscreen,
    exportPng,
    exportData,
  ]);

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
    const filename = buildExportFilename(
      canvasNameRef.current,
      activeCanvasRef.current,
    );
    window.dispatchEvent(
      new CustomEvent("drawtool:export-transparent", {
        detail: { filename, watermark: !isProRef.current },
      }),
    );
  }, []);

  const exportSvgFn = useCallback((transparent: boolean) => {
    const filename = buildExportFilename(
      canvasNameRef.current,
      activeCanvasRef.current,
    );
    window.dispatchEvent(
      new CustomEvent("drawtool:export-svg", {
        detail: { transparent, filename, watermark: false },
      }),
    );
  }, []);

  const exportSelectionSvgFn = useCallback((transparent: boolean) => {
    const filename = buildExportFilename(
      canvasNameRef.current,
      activeCanvasRef.current,
    );
    window.dispatchEvent(
      new CustomEvent("drawtool:export-selection-svg", {
        detail: { transparent, filename, watermark: false },
      }),
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
    if (localStorage.getItem("drawtool-onboarded")) return;
    document.fonts
      .load("400 20px 'Caveat Brush'")
      .then(() => setShowOnboarding(true));
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
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { canvasLimit, isPro, planLoading, subscription } = useUserPlan();
  const cloudCanvas = useCloudCanvas(
    isDark,
    canvasLimit,
    planLoading,
    isPro,
    settings.lastActiveCanvasId,
    _newRouteForCloud,
  );
  cloudActiveIdRef.current = cloudCanvas.activeId;
  cloudCanvasesRef.current = cloudCanvas.workspace?.canvases ?? [];
  const hasCloudCanvases = (cloudCanvas.workspace?.canvases.length ?? 0) > 0;

  // When /new finds all cloud canvases occupied, open the dialog + blur
  useEffect(() => {
    if (cloudCanvas.newRouteAllOccupied) {
      setNewCanvasDialogOpen(true);
      setNewCanvasBlurred(true);
    }
  }, [cloudCanvas.newRouteAllOccupied]);
  const migration = useMigration(
    canvasLimit,
    planLoading,
    cloudCanvas.workspacesLoaded,
    hasCloudCanvases,
    isDark,
  );
  useCloudStash({
    items: stashItems,
    isPro,
    isSignedIn,
    onCloudLoad: setStashItems,
  });

  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  canvasLimitImportRef.current = canvasLimit;

  // Ref so the stale-closure event handler can trigger cloud switching
  const cloudSwitchRef = useRef<((n: number) => void) | null>(null);
  cloudSwitchRef.current = (n: number) => {
    if (!isSignedIn || !cloudCanvas.workspace) return;
    // Sort by position so index lookup is robust even when positions have gaps/duplicates
    const sorted = [...cloudCanvas.workspace.canvases].sort(
      (a, b) => a.position - b.position,
    );
    const meta = sorted[n - 1];
    if (meta) {
      cloudCanvas.switchCanvas(meta.id);
    } else if (!isPro && n > canvasLimit) {
      // blocked — upgrade modal handles the messaging
    } else {
      cloudCanvas.createCanvas("").then((newCanvas) => {
        if (newCanvas) cloudCanvas.switchCanvas(newCanvas.id);
      });
    }
  };

  // Ref so the stale-closure event handler can find a blank canvas (cloud-aware)
  const findBlankCanvasRef = useRef<(() => void) | null>(null);
  findBlankCanvasRef.current = () => {
    if (isSignedIn && cloudCanvas.workspace) {
      const candidates = cloudCanvas.workspace.canvases.slice(0, canvasLimit);
      const blank = candidates.find((c) => c.stroke_count === 0);
      const target =
        blank ?? [...candidates].sort((a, b) => a.updated_at - b.updated_at)[0];
      if (target) {
        const slotN = target.position + 1;
        setActiveCanvas(slotN);
        localStorage.setItem("drawtool-active-canvas", String(slotN));
        setCanvasName(target.name);
        cloudCanvas.switchCanvas(target.id);
        showToast({ type: "text", message: `Canvas ${slotN}` });
      }
    } else {
      const counts = Array.from({ length: canvasLimit }, (_, i) => {
        const raw = localStorage.getItem(strokesKey(i + 1));
        if (!raw) return 0;
        try {
          return (JSON.parse(raw) as unknown[]).length;
        } catch {
          return 0;
        }
      });
      const empty = counts.findIndex((n) => n === 0);
      window.dispatchEvent(
        new CustomEvent("drawtool:switch-canvas", {
          detail:
            empty !== -1
              ? empty + 1
              : counts.findIndex((n) => n === Math.min(...counts)) + 1,
        }),
      );
    }
  };

  const exportWorkspacesZip = useCallback(async () => {
    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/workspaces/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { workspaces } = (await res.json()) as {
      workspaces: Array<{
        name: string;
        canvases: Array<{ name: string; [k: string]: unknown }>;
      }>;
    };
    const { zipSync, strToU8 } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    for (const ws of workspaces) {
      const safeName = ws.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
      for (const canvas of ws.canvases) {
        const safeCanvas = canvas.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
        files[`${safeName}/${safeCanvas}.json`] = strToU8(
          JSON.stringify(canvas, null, 2),
        );
      }
    }
    const zip = zipSync(files);
    const url = URL.createObjectURL(
      new Blob([zip], { type: "application/zip" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawzilla-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [getToken]);

  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  // Save local activeCanvas before cloud takes over; restore it on logout
  const prevSignedInRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (isSignedIn === undefined) return;
    const prev = prevSignedInRef.current;
    prevSignedInRef.current = isSignedIn;

    if (prev !== true && isSignedIn === true) {
      // Just logged in — snapshot the current local slot so we can return to it on logout
      localStorage.setItem(
        "drawtool-precloud-active",
        String(activeCanvasRef.current),
      );
    }

    if (prev === true && isSignedIn === false) {
      // Just logged out — restore the pre-login local canvas slot
      const saved = localStorage.getItem("drawtool-precloud-active");
      localStorage.removeItem("drawtool-precloud-active");
      const slot = saved
        ? Math.max(1, Math.min(9, parseInt(saved, 10) || 1))
        : 1;
      setActiveCanvas(slot);
      activeCanvasRef.current = slot;
      localStorage.setItem("drawtool-active-canvas", String(slot));
      const name = localStorage.getItem(`drawtool-canvas-name-${slot}`) ?? "";
      setCanvasName(name);
      canvasNameRef.current = name;
    }
  }, [isSignedIn]);

  // ⌘O opens workspace switcher (Pro only)
  useEffect(() => {
    if (!isSignedIn || !isPro) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "o" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setShowWorkspaceSwitcher((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [isSignedIn, isPro]);

  // Load share links for the active cloud canvas
  useEffect(() => {
    if (!isSignedIn || !cloudCanvas.activeId) return;
    cloudCanvas.loadCanvasShares(cloudCanvas.activeId);
  }, [isSignedIn, cloudCanvas.activeId]);

  // Persist active cloud canvas to settings so other devices restore it on sign-in
  useEffect(() => {
    if (!isSignedIn || !cloudCanvas.activeId) return;
    updateSettings({ lastActiveCanvasId: cloudCanvas.activeId });
  }, [cloudCanvas.activeId, isSignedIn]);

  // Sync cloud canvas name and slot number into local state
  useEffect(() => {
    if (!cloudCanvas.activeCanvasMeta) return;
    const n = cloudCanvas.activeCanvasMeta.position + 1;
    setActiveCanvas(n);
    activeCanvasRef.current = n;
    localStorage.setItem("drawtool-active-canvas", String(n));
    setCanvasName(cloudCanvas.activeCanvasMeta.name);
    canvasNameRef.current = cloudCanvas.activeCanvasMeta.name;
  }, [cloudCanvas.activeCanvasMeta?.id, cloudCanvas.activeCanvasMeta?.name]);

  // Welcome toast after Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unleashed") === "1") {
      window.history.replaceState(null, "", window.location.pathname);
      showToast({ type: "text", message: "Welcome to Unleashed!" }, 3000);
    }
  }, []);
  const mod = isMac ? "\u2318" : "Ctrl";
  const alt = isMac ? "\u2325" : "Alt";
  const shift = "\u21e7";

  const K = ({ children }: { children: ReactNode }) => (
    <kbd
      style={{
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        padding: "0px 4px",
        borderRadius: 3,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)"}`,
        background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
        display: "inline-block",
        lineHeight: "1.5",
      }}
    >
      {children}
    </kbd>
  );
  const kbTips: ReactNode[] = [
    <>
      Hold <K>Space</K> + drag to pan
    </>,
    <>
      Hold <K>R</K> + drag for rectangle
    </>,
    <>
      Hold <K>C</K> + drag for circle
    </>,
    <>
      Hold <K>A</K> + drag for arrow
    </>,
    <>
      Hold <K>{shift}</K> + drag for a dashed stroke
    </>,
    <>
      Hold <K>{shift}</K> + <K>A</K> + drag for dashed arrow
    </>,
    <>
      Hold <K>{shift}</K> + <K>R</K> + drag for dashed rectangle
    </>,
    <>
      Hold <K>F</K> + <K>C</K> + drag for filled circle
    </>,
    <>
      Hold <K>{shift}</K> + <K>S</K> + drag for dashed shape
    </>,
    <>
      Hold <K>F</K> + <K>S</K> + drag for filled shape
    </>,
    <>
      Hold <K>{shift}</K> + <K>F</K> + <K>S</K> + drag for dashed filled shape
    </>,
    <>
      Double-tap <K>V</K> for select mode
    </>,
    <>
      Hold <K>W</K> + drag to highlight
    </>,
    <>
      Hold <K>B</K> + drag for spray paint
    </>,
    <>
      Hold <K>Q</K> / <K>L</K> + drag for laser pointer
    </>,
    <>
      Press <K>.</K> to place a dot
    </>,
    <>
      <K>[</K> or <K>]</K> to cycle color
    </>,
    <>
      <K>,</K> to swap between last 2 colors
    </>,
    <>
      <K>{"{"}</K> or <K>{"}"}</K> to adjust thickness
    </>,
    <>
      Press <K>G</K> to cycle grid
    </>,
    <>
      Press <K>0</K> to jump to cleanest canvas
    </>,
    <>
      <K>{mod}</K> + <K>{shift}</K> + <K>S</K> to save selection to stash
    </>,
    <>
      <K>{mod}</K> + <K>Z</K> to undo, <K>{shift}</K> + <K>{mod}</K> + <K>Z</K>{" "}
      to redo
    </>,
    <>
      <K>{mod}</K> + <K>A</K> to select all
    </>,
    <>
      <K>{mod}</K> + <K>D</K> to duplicate selection
    </>,
    <>
      <K>Backspace</K> to delete selection
    </>,
    <>
      <K>{mod}</K> + <K>C</K> / <K>X</K> / <K>V</K> to copy, cut, paste
    </>,
    <>Arrow keys to pan (or nudge selection)</>,
    <>
      <K>+</K> / <K>-</K> to zoom in / out
    </>,
    <>
      <K>{isMac ? "Ctrl" : mod}</K> + scroll to zoom
    </>,
    <>
      <K>{shift}</K> + <K>1</K> to fit view, <K>{shift}</K> + <K>2</K> to center
    </>,
    <>
      Press <K>T</K> to add text
    </>,
    <>
      <K>1</K>–<K>9</K> to switch canvas
    </>,
    <>
      <K>{mod}</K> + <K>E</K> to export
    </>,
    <>
      Press <K>K</K> to lock / unlock selection
    </>,
    <>
      Press <K>E</K> to toggle sharp / rounded corners
    </>,
    <>
      Press <K>P</K> to toggle dynamic stroke on / off
    </>,
    <>
      <K>{mod}</K> + <K>{shift}</K> + <K>H</K> / <K>V</K> to flip selection
    </>,
    <>
      <K>{mod}</K> + <K>J</K> to combine strokes, <K>{shift}</K> + <K>{mod}</K>{" "}
      + <K>J</K> to uncombine
    </>,
    <>
      <K>{mod}</K> + <K>,</K> to rename canvas
    </>,
    <>
      Press <K>M</K> to toggle menu
    </>,
    <>
      Press <K>?</K> to see all shortcuts
    </>,
    <>
      Press <K>S</K> to change shape
    </>,
    <>
      Hold <K>S</K> to peek shape
    </>,
  ];

  const tipOrderRef = useRef<number[] | null>(null);
  if (!tipOrderRef.current || tipOrderRef.current.length !== kbTips.length) {
    tipOrderRef.current = Array.from(
      { length: kbTips.length },
      (_, i) => i,
    ).sort(() => Math.random() - 0.5);
  }

  useEffect(() => {
    if (!settings.showTips || hasTouch) return;
    const INTERVAL = 8000;
    const FADE = 400;
    const timer = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % kbTips.length);
        setTipVisible(true);
      }, FADE);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [settings.showTips, hasTouch, kbTips.length]);

  // Reset select hint when switching canvas
  useEffect(() => {
    if (selectHintTimerRef.current) {
      clearTimeout(selectHintTimerRef.current);
      selectHintTimerRef.current = null;
    }
    setSelectHintVisible(false);
  }, [
    activeCanvas,
    cloudCanvas.activeId,
    cloudCanvas.loadKey,
    cloudCanvas.clearKey,
  ]);

  const visibleLineColor =
    (settings.lineColor === "#000000" && isDark) ||
    (settings.lineColor === "#ffffff" && !isDark)
      ? "currentColor"
      : settings.lineColor;
  const touchTools: { id: TouchTool; label: string; icon: ReactNode }[] =
    useMemo(
      () => [
        {
          id: "hand",
          label: "Move",
          icon: <Hand size={17} strokeWidth={2} />,
        },
        {
          id: "draw",
          label: "Draw",
          icon: <Pencil size={17} strokeWidth={1.75} />,
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
          id: "shape",
          label: "Shape",
          icon: (() => {
            const p = { size: 17, strokeWidth: 2, fill: "none" } as const;
            const s = settings.activeShape;
            if (s === "rectangle") return <Square {...p} />;
            if (s === "circle") return <Circle {...p} />;
            if (s === "triangle") return <Triangle {...p} />;
            if (s === "diamond") return <Diamond {...p} />;
            if (s === "pentagon") return <Pentagon {...p} />;
            if (s === "hexagon") return <Hexagon {...p} />;
            if (s === "star") return <Star {...p} />;
            if (s === "arrow") return <ArrowRight {...p} />;
            if (s === "cloud") return <Cloud {...p} />;
            return (
              <svg
                width="17"
                height="17"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="3" y1="13" x2="13" y2="3" />
              </svg>
            );
          })(),
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
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.4"
            >
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          ),
        },
        {
          id: "text",
          label: "Text",
          icon: <Type size={17} strokeWidth={1.75} />,
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
      [settings.activeShape],
    );

  return (
    <>
      {showWorkspaceSwitcher && isSignedIn && (
        <WorkspaceSwitcherModal
          allWorkspaces={cloudCanvas.allWorkspaces}
          activeWorkspaceId={cloudCanvas.workspace?.id ?? null}
          activeCanvasId={cloudCanvas.activeId}
          isPro={isPro}
          loading={cloudCanvas.loading}
          isDark={isDark}
          theme={settings.theme}
          onSelectCanvas={async (workspaceId, canvasId) => {
            if (workspaceId !== cloudCanvas.workspace?.id) {
              await cloudCanvas.switchWorkspace(workspaceId, canvasId);
            } else {
              await cloudCanvas.switchCanvas(canvasId);
            }
          }}
          onSelectWorkspace={(id) => cloudCanvas.switchWorkspace(id)}
          onCreateWorkspace={async (name) => {
            const ws = await cloudCanvas.createWorkspace(name || undefined);
            if (ws) {
              await cloudCanvas.switchWorkspace(ws.id);
            }
          }}
          onRenameCanvas={cloudCanvas.renameCanvas}
          onRenameWorkspace={cloudCanvas.renameWorkspace}
          onPinWorkspace={cloudCanvas.pinWorkspace}
          onFavouriteWorkspace={cloudCanvas.favouriteWorkspace}
          onRemoveCanvas={async (id, isLast) => {
            if (isLast) return cloudCanvas.clearCanvas(id);
            return cloudCanvas.deleteCanvas(id);
          }}
          onDeleteWorkspace={cloudCanvas.deleteWorkspace}
          onResetWorkspace={async (wsId) => {
            const ws = cloudCanvas.allWorkspaces.find((w) => w.id === wsId);
            if (!ws) return false;
            await Promise.all(
              ws.canvases.slice(1).map((c) => cloudCanvas.deleteCanvas(c.id)),
            );
            return cloudCanvas.clearCanvas(ws.canvases[0]?.id ?? "");
          }}
          showTips={settings.showTips}
          hasTouch={hasTouch}
          onClose={() => setShowWorkspaceSwitcher(false)}
          onPrefetchThumbnail={cloudCanvas.prefetchThumbnail}
        />
      )}
      {migration.showModal && (
        <MigrationModal
          localCanvases={migration.localCanvases}
          willMigrateCount={migration.willMigrateCount}
          skippedCount={migration.skippedCount}
          onMigrate={async () => {
            await migration.migrate();
            cloudCanvas.fetchWorkspace();
          }}
          onSkip={migration.skip}
          migrating={migration.migrating}
          error={migration.error}
          isDark={isDark}
        />
      )}
      {CLOUD_ENABLED && !isPro && !planLoading && (
        <a
          href="https://unleash.drawzil.la"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-[20px] right-[62px] z-40 h-[30px] px-2.5 flex items-center justify-center rounded-md backdrop-blur-sm select-none transition-opacity opacity-40 hover:opacity-75"
          style={{
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(0,0,0,0.10)",
            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          Unleashed
        </a>
      )}
      <Menu
        settings={settings}
        updateSettings={updateSettings}
        onExport={
          activeCanvas <= canvasLimit || isPro
            ? (format, transparent) => {
                if (format === "svg") exportSvgFn(transparent);
                else if (transparent) exportTransparent();
                else exportPng();
              }
            : undefined
        }
        exportFormat={settings.exportFormat}
        exportTransparentBg={settings.exportTransparentBg}
        onSetExportFormat={(f) => updateSettings({ exportFormat: f })}
        onSetExportTransparentBg={(v) =>
          updateSettings({ exportTransparentBg: v })
        }
        exportIncludeImages={settings.exportIncludeImages}
        onSetExportIncludeImages={(v) =>
          updateSettings({ exportIncludeImages: v })
        }
        hasTouch={hasTouch}
        isTablet={isTablet}
        activeCanvas={activeCanvas}
        onSwitchCanvas={(n) => {
          if (isSignedIn && cloudCanvas.workspace) {
            cloudSwitchRef.current?.(n);
          } else {
            setActiveCanvas(n);
            const name =
              localStorage.getItem(`drawtool-canvas-name-${n}`) ?? "";
            setCanvasName(name);
            canvasNameRef.current = name;
            localStorage.setItem("drawtool-active-canvas", String(n));
          }
        }}
        onReorderCanvases={(newOrder) => {
          const newActivePos = newOrder.indexOf(activeCanvas) + 1;
          reorderCanvases(newOrder);
          const newName =
            localStorage.getItem(`drawtool-canvas-name-${newActivePos}`) ?? "";
          setActiveCanvas(newActivePos);
          setCanvasName(newName);
          canvasNameRef.current = newName;
          localStorage.setItem("drawtool-active-canvas", String(newActivePos));
        }}
        onToggleFullscreen={toggleFullscreen}
        onResetView={resetView}
        onExportData={exportData}
        onImportData={importData}
        onExportWorkspace={exportWorkspaceData}
        onImportWorkspace={importWorkspaceData}
        onStartTraining={openTraining}
        stashCount={stashItems.length}
        selectionCount={selectionCount}
        onExportSelection={(transparent) => exportSelectionSvgFn(transparent)}
        canvasLimit={canvasLimit}
        isPro={isPro}
        cloudCanvases={
          isSignedIn && cloudCanvas.workspace
            ? cloudCanvas.workspace.canvases
            : undefined
        }
        activeCloudCanvasId={cloudCanvas.activeId}
        onReorderCloud={cloudCanvas.reorderCanvases}
        canvasShares={isSignedIn ? cloudCanvas.currentShares : undefined}
        existingShareWorkspaceUrl={
          cloudCanvas.workspace?.share_enabled
            ? `${window.location.origin}/s/w/${cloudCanvas.workspace.share_token}`
            : null
        }
        onShareCanvas={
          isSignedIn && cloudCanvas.activeId && activeCanvas <= canvasLimit
            ? () => cloudCanvas.createShare(cloudCanvas.activeId!)
            : undefined
        }
        onDeleteShare={
          isSignedIn && cloudCanvas.activeId && activeCanvas <= canvasLimit
            ? (token) => cloudCanvas.deleteShare(cloudCanvas.activeId!, token)
            : undefined
        }
        onShareWorkspace={
          isSignedIn && cloudCanvas.workspace && isPro
            ? () => cloudCanvas.shareWorkspace().then((r) => r?.url ?? null)
            : undefined
        }
        onUnshareWorkspace={
          isSignedIn && cloudCanvas.workspace && isPro
            ? () => cloudCanvas.unshareWorkspace()
            : undefined
        }
        subscription={subscription}
        onExportWorkspacesZip={exportWorkspacesZip}
        onResubscribe={() => openBillingPortal(getToken)}
        cloudEnabled={CLOUD_ENABLED}
      />
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            window.dispatchEvent(
              new CustomEvent("drawtool:insert-image", { detail: file }),
            );
          e.target.value = "";
        }}
      />
      {!cloudCanvas.newRoutePending && (
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
          key={
            showTraining
              ? "training"
              : cloudCanvas.activeId
                ? `${cloudCanvas.activeId}-lk${cloudCanvas.loadKey}${cloudCanvas.clearKey ? `-c${cloudCanvas.clearKey}` : ""}`
                : String(activeCanvas)
          }
          canvasIndex={
            showTraining ? 0 : cloudCanvas.activeId ? 1 : activeCanvas
          }
          canvasLimit={canvasLimit}
          textSize={settings.textSize}
          fontFamily={settings.fontFamily}
          textBold={settings.textBold}
          textItalic={settings.textItalic}
          textAlign={settings.textAlign}
          pressureSensitivity={settings.pressureSensitivity}
          leftClickTool={settings.leftClickTool}
          rightClickTool={settings.rightClickTool}
          onContentOffScreen={setContentOffScreen}
        />
      )}
      {activeCanvas > canvasLimit &&
        !isPro &&
        !planLoading &&
        !showTraining && (
          <div
            className="fixed inset-0 z-10 flex items-center justify-center pointer-events-auto select-none"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={`relative flex flex-col items-center gap-5 px-8 py-7 rounded-2xl backdrop-blur-md overflow-hidden max-w-[260px] w-full text-center ${isDark ? "bg-white/[0.05] border border-white/[0.08]" : "bg-white/75 border border-black/[0.07]"}`}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% -10%, rgba(34,197,94,0.12) 0%, transparent 65%)",
                }}
              />
              <img
                src="/drawzillaicon.svg"
                className="relative w-20 h-20"
                draggable={false}
              />
              <div className="relative flex flex-col gap-1">
                <p
                  className={`text-sm font-semibold ${isDark ? "text-white/85" : "text-black/75"}`}
                >
                  Unlock 9 canvases
                </p>
                <p
                  className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  More canvases, workspaces, clean exports &amp; live share
                  links
                </p>
              </div>
              <a
                href="https://unleash.drawzil.la"
                target="_blank"
                rel="noopener noreferrer"
                className="relative px-5 py-2 rounded-lg text-xs font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                }}
              >
                Get Unleashed →
              </a>
            </div>
          </div>
        )}
      {settings.showSelectControls && hasSelection && (
        <SelectControls
          isDark={isDark}
          theme={settings.theme}
          selectionCount={selectionCount}
          selectionIsCombined={selectionIsCombined}
          selectionIsText={selectionIsText}
          selectionIsLocked={selectionIsLocked}
        />
      )}
      {hasTouch ? (
        <>
          {(showShapePicker ||
            showThicknessPicker ||
            showHighlightPicker ||
            showTextPicker ||
            showSelectPicker ||
            showColorPicker) && (
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => {
                setShowShapePicker(false);
                setShowThicknessPicker(null);
                setShowHighlightPicker(false);
                setShowTextPicker(false);
                setShowSelectPicker(false);
                setShowColorPicker(false);
              }}
            />
          )}
          <nav
            aria-label="Drawing tools"
            className={`fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-1 touch-toolbar ${isTablet ? "top-4" : ""}`}
            style={
              !isTablet
                ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }
                : undefined
            }
            onTouchStart={(e) => {
              if (e.touches.length !== 1) return;
              swipeStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
              };
            }}
            onTouchEnd={(e) => {
              if (!swipeStartRef.current || e.changedTouches.length !== 1)
                return;
              const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
              const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
              swipeStartRef.current = null;
              if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;
              if (
                showShapePicker ||
                showThicknessPicker ||
                showHighlightPicker ||
                showTextPicker ||
                showSelectPicker ||
                showColorPicker
              )
                return;
              e.preventDefault();
              const next =
                dx < 0
                  ? activeCanvas < canvasLimit
                    ? activeCanvas + 1
                    : 1
                  : activeCanvas > 1
                    ? activeCanvas - 1
                    : canvasLimit;
              if (isSignedIn && cloudCanvas.workspace) {
                cloudSwitchRef.current?.(next);
              } else {
                setActiveCanvas(next);
                const name =
                  localStorage.getItem(`drawtool-canvas-name-${next}`) ?? "";
                setCanvasName(name);
                canvasNameRef.current = name;
                localStorage.setItem("drawtool-active-canvas", String(next));
              }
              showToast({ type: "text", message: `Canvas ${next}` }, 800);
            }}
          >
            {showHoldHint && (
              <div
                className={`absolute left-3 pointer-events-none select-none ${isTablet ? "top-full mt-1" : "bottom-full mb-1"}`}
                style={{
                  fontSize: 20,
                  fontFamily: "Caveat, cursive",
                  color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                }}
              >
                {isTablet ? (
                  <span className="flex items-center gap-1">
                    Hold for more options
                    <svg
                      width="12"
                      height="16"
                      viewBox="0 0 12 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 15 H8 V1" />
                      <path d="M5 4 L8 1 L11 4" />
                    </svg>
                  </span>
                ) : (
                  "Hold for options ↴"
                )}
              </div>
            )}
            {/* Undo / Redo / Delete — tablet: below toolbar right; mobile: above toolbar right */}
            <div className={`absolute right-1 flex items-center gap-0.5 ${isTablet ? "top-full mt-1" : "bottom-full mb-1"}`}>
                <button
                  aria-label="Undo"
                  disabled={!canUndo}
                  onClick={() =>
                    window.dispatchEvent(new Event("drawtool:undo"))
                  }
                  className={`flex items-center justify-center w-9 h-9 leading-none rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canUndo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <Undo2 size={20} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Redo"
                  disabled={!canRedo}
                  onClick={() =>
                    window.dispatchEvent(new Event("drawtool:redo"))
                  }
                  className={`flex items-center justify-center w-9 h-9 leading-none rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${canRedo ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <Redo2 size={20} strokeWidth={1.75} />
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
                  className={`flex items-center justify-center w-9 h-9 leading-none rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${hasSelection ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <Trash2 size={20} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Save to stash"
                  disabled={!hasSelection}
                  onClick={() =>
                    window.dispatchEvent(new Event("drawtool:save-to-stash"))
                  }
                  className={`flex items-center justify-center w-9 h-9 leading-none rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${hasSelection ? (isDark ? "text-white/70 hover:text-white" : "text-black/55 hover:text-black") : isDark ? "text-white/20" : "text-black/15"}`}
                >
                  <Layers size={20} strokeWidth={1.75} />
                </button>
            </div>
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
                  t.id === "highlight" ||
                  t.id === "text" ||
                  t.id === "select";
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
                      if (textLongPressRef.current) {
                        clearTimeout(textLongPressRef.current);
                        textLongPressRef.current = null;
                      }
                      if (longPressFiredRef.current) {
                        longPressFiredRef.current = false;
                        return;
                      }
                      if (
                        !showShapePicker &&
                        !showThicknessPicker &&
                        !showHighlightPicker &&
                        !showTextPicker
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
                      setShowTextPicker(false);
                      setShowSelectPicker(false);
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
                                setShowTextPicker(false);
                                setTouchTool(t.id);
                                thicknessLongPressRef.current = null;
                                longPressFiredRef.current = true;
                              }, 400);
                            } else if (t.id === "text") {
                              textLongPressRef.current = setTimeout(() => {
                                setShowTextPicker(true);
                                setShowThicknessPicker(null);
                                setShowShapePicker(false);
                                setShowHighlightPicker(false);
                                setTouchTool("text");
                                textLongPressRef.current = null;
                                longPressFiredRef.current = true;
                              }, 400);
                            } else if (t.id === "select") {
                              selectLongPressRef.current = setTimeout(() => {
                                setShowSelectPicker(true);
                                setShowThicknessPicker(null);
                                setShowShapePicker(false);
                                setShowHighlightPicker(false);
                                setShowTextPicker(false);
                                selectLongPressRef.current = null;
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
                      if (textLongPressRef.current) {
                        clearTimeout(textLongPressRef.current);
                        textLongPressRef.current = null;
                      }
                      if (selectLongPressRef.current) {
                        clearTimeout(selectLongPressRef.current);
                        selectLongPressRef.current = null;
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
                      if (textLongPressRef.current) {
                        clearTimeout(textLongPressRef.current);
                        textLongPressRef.current = null;
                      }
                      if (selectLongPressRef.current) {
                        clearTimeout(selectLongPressRef.current);
                        selectLongPressRef.current = null;
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
                        stroke={visibleLineColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle
                          cx="1.5"
                          cy="3.5"
                          r="0.85"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="0.5"
                          cy="6.5"
                          r="0.75"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="1.5"
                          cy="9.5"
                          r="0.75"
                          fill={visibleLineColor}
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
              {/* Color swatch button */}
              <div
                className={`w-px self-stretch mx-0.5 ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              <button
                aria-label={`Color: ${settings.lineColor}`}
                onClick={() => {
                  setShowColorPicker((v) => !v);
                  setShowShapePicker(false);
                  setShowThicknessPicker(null);
                  setShowHighlightPicker(false);
                  setShowTextPicker(false);
                }}
                className={`flex items-center justify-center px-2.5 py-2.5 sm:px-3 sm:py-3 rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${showColorPicker ? (isDark ? "bg-white/20" : "bg-black/20") : isDark ? "hover:bg-white/10" : "hover:bg-black/10"}`}
              >
                <span
                  className="w-4 h-4 rounded-full block flex-shrink-0"
                  style={{
                    backgroundColor: settings.lineColor,
                    boxShadow:
                      settings.lineColor === "#000000" && isDark
                        ? "0 0 0 2px white"
                        : settings.lineColor === "#ffffff" && !isDark
                          ? "0 0 0 2px rgba(0,0,0,0.55)"
                          : isDark
                            ? "0 0 0 1.5px rgba(255,255,255,0.3)"
                            : "0 0 0 1.5px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
              {showColorPicker && (
                <div
                  className={`absolute p-2 rounded-lg border backdrop-blur-sm ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
                  style={{
                    background: isDark
                      ? "rgba(0,0,0,0.85)"
                      : "rgba(255,255,255,0.85)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.15)",
                    right: 0,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div
                    className="flex flex-wrap gap-1.5 justify-center"
                    style={{ maxWidth: "13rem" }}
                  >
                    {[
                      isDark ? "#ffffff" : "#000000",
                      isDark ? "#000000" : "#ffffff",
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
                        onClick={() => {
                          updateSettings({ lineColor: color });
                          setShowColorPicker(false);
                        }}
                        aria-label={`Color ${color}`}
                        aria-pressed={settings.lineColor === color}
                        className="w-8 h-8 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-blue-400"
                        style={{
                          backgroundColor: color,
                          borderColor:
                            settings.lineColor === color
                              ? isDark
                                ? "white"
                                : "black"
                              : color === "#000000" || color === "#ffffff"
                                ? isDark
                                  ? "#555"
                                  : "#bbb"
                                : "transparent",
                          transform:
                            settings.lineColor === color
                              ? "scale(1.15)"
                              : undefined,
                        }}
                      />
                    ))}
                  </div>
                  {isPro && (
                    <>
                      <div
                        className="my-2"
                        style={{
                          height: 1,
                          background: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.08)",
                        }}
                      />
                      <div className="flex items-center gap-1.5 justify-center">
                        <label
                          className={`relative w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors ${isDark ? "text-white/50 hover:text-white/80 bg-white/8 hover:bg-white/15" : "text-black/40 hover:text-black/70 bg-black/5 hover:bg-black/10"}`}
                          title="Pick custom colour"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="color"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value={settings.customColor ?? "#ff6600"}
                            onChange={(e) => {
                              const c = e.target.value;
                              updateSettings({ customColor: c, lineColor: c });
                            }}
                          />
                          <Pipette size={14} strokeWidth={2} />
                        </label>
                        <button
                          onClick={() => {
                            const c = settings.customColor ?? "#ff6600";
                            updateSettings({ lineColor: c });
                            setShowColorPicker(false);
                          }}
                          aria-label={`Use custom colour ${settings.customColor}`}
                          aria-pressed={
                            settings.lineColor === settings.customColor
                          }
                          className="w-8 h-8 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-blue-400"
                          style={{
                            backgroundColor: settings.customColor ?? "#ff6600",
                            borderColor:
                              settings.lineColor ===
                              (settings.customColor ?? "#ff6600")
                                ? isDark
                                  ? "white"
                                  : "black"
                                : isDark
                                  ? "rgba(255,255,255,0.35)"
                                  : "rgba(0,0,0,0.2)",
                            transform:
                              settings.lineColor ===
                              (settings.customColor ?? "#ff6600")
                                ? "scale(1.15)"
                                : undefined,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
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
                      isDark ? "#000000" : "#ffffff",
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
                        className="w-8 h-8 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-blue-400"
                        style={{
                          backgroundColor: color,
                          borderColor:
                            settings.lineColor === color
                              ? isDark
                                ? "white"
                                : "black"
                              : color === "#000000" || color === "#ffffff"
                                ? isDark
                                  ? "#555"
                                  : "#bbb"
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
                        stroke={visibleLineColor}
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
                          fill={visibleLineColor}
                        />
                      </svg>
                    )}
                    {settings.shapeFill === "dots" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={visibleLineColor}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        opacity={settings.shapeFillEnabled ? 1 : 0.35}
                      >
                        <rect x="2" y="2" width="12" height="12" rx="1.5" />
                        <circle
                          cx="6"
                          cy="6.5"
                          r="1.2"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="6.5"
                          r="1.2"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="6"
                          cy="10.5"
                          r="1.2"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="10.5"
                          r="1.2"
                          fill={visibleLineColor}
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
                        stroke={visibleLineColor}
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
                        stroke={visibleLineColor}
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
                      stroke={visibleLineColor}
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
                      {(() => {
                        const p = {
                          size: 20,
                          strokeWidth: 2,
                          stroke: visibleLineColor,
                          fill: "none",
                        } as const;
                        if (shape === "rectangle") return <Square {...p} />;
                        if (shape === "circle") return <Circle {...p} />;
                        if (shape === "triangle") return <Triangle {...p} />;
                        if (shape === "diamond") return <Diamond {...p} />;
                        if (shape === "pentagon") return <Pentagon {...p} />;
                        if (shape === "hexagon") return <Hexagon {...p} />;
                        if (shape === "star") return <Star {...p} />;
                        if (shape === "arrow") return <ArrowRight {...p} />;
                        if (shape === "cloud") return <Cloud {...p} />;
                        return (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke={visibleLineColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <line x1="3" y1="13" x2="13" y2="3" />
                          </svg>
                        );
                      })()}
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
                        stroke={visibleLineColor}
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
                        stroke={visibleLineColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle
                          cx="1.5"
                          cy="3.5"
                          r="0.85"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="0.5"
                          cy="6.5"
                          r="0.75"
                          fill={visibleLineColor}
                          stroke="none"
                        />
                        <circle
                          cx="1.5"
                          cy="9.5"
                          r="0.75"
                          fill={visibleLineColor}
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
            {showSelectPicker && (
              <div
                className={`absolute rounded-xl border backdrop-blur-sm ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
                style={{
                  background: isDark ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.88)",
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  maxWidth: "calc(100vw - 2rem)",
                  maxHeight: "65dvh",
                  overflow: "hidden auto",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {hasSelection ? (() => {
                  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
                  const layerActions = COMMON_ACTIONS.filter(a => a.group === "layer");
                  const editActions = COMMON_ACTIONS.filter(a => a.group === "edit");
                  const viewActions = COMMON_ACTIONS.filter(a => a.group === "view");
                  const contextActions = selectionIsText ? TEXT_ACTIONS : DRAWING_ACTIONS;
                  const lockA: SelectAction = {
                    label: selectionIsLocked ? "Unlock" : "Lock",
                    group: "lock",
                    icon: selectionIsLocked ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="9" width="12" height="9" rx="1.5" />
                        <path d="M7 9V6.5a3 3 0 016 0" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="9" width="12" height="9" rx="1.5" />
                        <path d="M7 9V6.5a3 3 0 016 0V9" />
                      </svg>
                    ),
                    action: () => selectKd({ key: "k" }),
                  };
                  const tailActions: SelectAction[] = [
                    DANGER_ACTION,
                    ...(selectionCount > 1 ? [COMBINE_ACTION] : []),
                    ...(selectionIsCombined ? [UNCOMBINE_ACTION] : []),
                  ];

                  const renderBtn = (a: SelectAction) => (
                    <button
                      key={a.label}
                      aria-label={a.label}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        a.action();
                        setShowSelectPicker(false);
                      }}
                      className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-colors ${
                        a.group === "danger"
                          ? (isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-500/10")
                          : a.group === "lock" && selectionIsLocked
                            ? (isDark ? "text-[#78b8ff] hover:bg-white/10" : "text-[#2d64c8] hover:bg-black/5")
                            : (isDark ? "text-white/65 hover:bg-white/10" : "text-black/55 hover:bg-black/5")
                      }`}
                    >
                      {a.icon}
                      <span className="text-[9px] leading-none opacity-60">{a.label}</span>
                    </button>
                  );

                  const Divider = () => (
                    <div className="col-span-4" style={{ height: 1, background: border, margin: "2px 6px" }} />
                  );

                  return (
                    <div className="p-2 grid grid-cols-4 gap-0.5">
                      {[...viewActions, ...layerActions].map(renderBtn)}
                      <Divider />
                      {editActions.map(renderBtn)}
                      <Divider />
                      {[...contextActions, lockA, ...tailActions].map(renderBtn)}
                    </div>
                  );
                })() : (
                  <div className="p-1.5 flex gap-1">
                    <button
                      aria-label="Select All"
                      onClick={() => {
                        window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }));
                        setShowSelectPicker(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2.5 rounded text-xs transition-colors ${isDark ? "text-white/80 hover:bg-white/10" : "text-black/70 hover:bg-black/10"}`}
                    >
                      <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1.5" y="1.5" width="13" height="13" rx="1" strokeDasharray="2.5 1.5" />
                        <path d="M4 8h8M8 4v8" />
                      </svg>
                      All
                    </button>
                    <button
                      aria-label="Paste"
                      onClick={() => {
                        window.dispatchEvent(new Event("drawtool:paste"));
                        setShowSelectPicker(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2.5 rounded text-xs transition-colors ${isDark ? "text-white/80 hover:bg-white/10" : "text-black/70 hover:bg-black/10"}`}
                    >
                      <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1.5" y="4" width="8" height="10.5" rx="1" />
                        <path d="M5.5 4V2.5A1 1 0 016.5 1.5h6A1 1 0 0113.5 2.5v9a1 1 0 01-1 1H10" strokeOpacity="0.45" />
                        <path d="M3.5 7.5h4M3.5 9.5h5M3.5 11.5h3" strokeOpacity="0.55" />
                      </svg>
                      Paste
                    </button>
                  </div>
                )}
              </div>
            )}
            {showTextPicker && (
              <div
                className={`absolute p-3 rounded-lg border backdrop-blur-sm ${isTablet ? "top-full mt-2" : "bottom-full mb-2"}`}
                style={{
                  background: isDark
                    ? "rgba(0,0,0,0.85)"
                    : "rgba(255,255,255,0.85)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.15)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  minWidth: "14rem",
                  maxWidth: "calc(100vw - 2rem)",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Size row */}
                <div className="flex items-center gap-1">
                  {(["xs", "s", "m", "l", "xl"] as TextSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ textSize: size })}
                      aria-label={`Text size ${size.toUpperCase()}`}
                      aria-pressed={settings.textSize === size}
                      className={`flex-1 flex items-center justify-center py-1 rounded text-xs font-medium transition-all duration-150 ${
                        settings.textSize === size
                          ? isDark
                            ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                            : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                          : isDark
                            ? "text-white/50 hover:text-white/70"
                            : "text-black/40 hover:text-black/60"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* Font row */}
                <div className="flex items-center gap-1 mt-2">
                  {(
                    [
                      { key: "caveat", css: "'Caveat', cursive" },
                      { key: "comic", css: "'Bangers', cursive" },
                      { key: "cartoon", css: "'Boogaloo', cursive" },
                      {
                        key: "sans",
                        css: "system-ui, -apple-system, sans-serif",
                      },
                      { key: "serif", css: "Georgia, serif" },
                      {
                        key: "mono",
                        css: "ui-monospace, 'Courier New', monospace",
                      },
                    ] as { key: FontFamily; css: string }[]
                  ).map(({ key, css }) => (
                    <button
                      key={key}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("drawtool:font-family", {
                            detail: key,
                          }),
                        )
                      }
                      aria-label={`Font ${key}`}
                      aria-pressed={settings.fontFamily === key}
                      style={{ fontFamily: css }}
                      className={`flex-1 flex items-center justify-center py-1 rounded text-base transition-all duration-150 ${
                        settings.fontFamily === key
                          ? isDark
                            ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                            : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                          : isDark
                            ? "text-white/50 hover:text-white/70"
                            : "text-black/40 hover:text-black/60"
                      }`}
                    >
                      Aa
                    </button>
                  ))}
                </div>
                {/* Bold / Italic / Alignment row */}
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() =>
                      window.dispatchEvent(new Event("drawtool:text-bold"))
                    }
                    aria-label="Bold"
                    aria-pressed={settings.textBold}
                    className={`flex-1 flex items-center justify-center py-1 rounded text-sm font-bold transition-all duration-150 ${
                      settings.textBold
                        ? isDark
                          ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "text-white/50 hover:text-white/70"
                          : "text-black/40 hover:text-black/60"
                    }`}
                  >
                    B
                  </button>
                  <button
                    onClick={() =>
                      window.dispatchEvent(new Event("drawtool:text-italic"))
                    }
                    aria-label="Italic"
                    aria-pressed={settings.textItalic}
                    className={`flex-1 flex items-center justify-center py-1 rounded text-sm italic transition-all duration-150 ${
                      settings.textItalic
                        ? isDark
                          ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "text-white/50 hover:text-white/70"
                          : "text-black/40 hover:text-black/60"
                    }`}
                  >
                    I
                  </button>
                  {(["left", "center", "right"] as TextAlign[]).map((align) => (
                    <button
                      key={align}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("drawtool:text-align", {
                            detail: align,
                          }),
                        )
                      }
                      aria-label={`Align ${align}`}
                      aria-pressed={settings.textAlign === align}
                      className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                        settings.textAlign === align
                          ? isDark
                            ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                            : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                          : isDark
                            ? "text-white/50 hover:text-white/70"
                            : "text-black/40 hover:text-black/60"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="currentColor"
                      >
                        <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                        {align === "left" && (
                          <>
                            <rect
                              x="1"
                              y="5.5"
                              width="8"
                              height="1.5"
                              rx="0.75"
                            />
                            <rect
                              x="1"
                              y="9"
                              width="10"
                              height="1.5"
                              rx="0.75"
                            />
                          </>
                        )}
                        {align === "center" && (
                          <>
                            <rect
                              x="3"
                              y="5.5"
                              width="8"
                              height="1.5"
                              rx="0.75"
                            />
                            <rect
                              x="2"
                              y="9"
                              width="10"
                              height="1.5"
                              rx="0.75"
                            />
                          </>
                        )}
                        {align === "right" && (
                          <>
                            <rect
                              x="5"
                              y="5.5"
                              width="8"
                              height="1.5"
                              rx="0.75"
                            />
                            <rect
                              x="3"
                              y="9"
                              width="10"
                              height="1.5"
                              rx="0.75"
                            />
                          </>
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>
          {isTablet && settings.showZoomControls && (
            <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
              <div
                className={`flex items-center h-8 rounded-lg border ${isDark ? "border-white/15" : "border-black/15"}`}
                style={{ background: getPanelBackground(settings.theme) }}
              >
                <button
                  onClick={zoomOut}
                  aria-label="Zoom out"
                  className={`w-8 h-full flex items-center justify-center rounded-l-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
                >
                  -
                </button>
                <div
                  className={`w-px h-full ${isDark ? "bg-white/15" : "bg-black/15"}`}
                />
                <button
                  onClick={resetView}
                  aria-label="Reset zoom to 100%"
                  className={`min-w-[3.25rem] px-2 h-full flex items-center justify-center transition-colors text-xs tabular-nums focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <div
                  className={`w-px h-full ${isDark ? "bg-white/15" : "bg-black/15"}`}
                />
                <button
                  onClick={zoomIn}
                  aria-label="Zoom in"
                  className={`w-8 h-full flex items-center justify-center rounded-r-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
                >
                  +
                </button>
              </div>
              <button
                onClick={centerView}
                aria-label="Fit to content"
                className={`w-8 h-8 flex items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${isDark ? "border-white/15 text-white/70 hover:text-white hover:bg-white/10" : "border-black/15 text-black/60 hover:text-black hover:bg-black/8"}`}
                style={{ background: getPanelBackground(settings.theme) }}
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
          )}
        </>
      ) : (
        settings.showZoomControls && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
            <div
              className={`flex items-center h-8 rounded-lg border ${isDark ? "border-white/15" : "border-black/15"}`}
              style={{ background: getPanelBackground(settings.theme) }}
            >
              <button
                onClick={zoomOut}
                aria-label="Zoom out"
                className={`w-8 h-full flex items-center justify-center rounded-l-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
              >
                -
              </button>
              <div
                className={`w-px h-full ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              <div className="relative group/zoom h-full">
                <div
                  className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs whitespace-nowrap rounded-lg border shadow-md opacity-0 group-hover/zoom:opacity-100 transition-opacity flex items-center gap-1.5 ${isDark ? "border-white/12 text-white/80" : "border-black/8 text-black/70"}`}
                  style={{ background: getPanelBackground(settings.theme) }}
                >
                  Reset zoom
                  {settings.showTips && !hasTouch && <kbd className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "border-white/20 bg-white/[0.08] text-white/50" : "border-black/12 bg-black/[0.04] text-black/40"}`}>⇧ + 1</kbd>}
                </div>
                <button
                  onClick={resetView}
                  aria-label="Reset zoom to 100%"
                  className={`min-w-[3.25rem] px-2 h-full flex items-center justify-center transition-colors text-xs tabular-nums focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
                >
                  {Math.round(zoom * 100)}%
                </button>
              </div>
              <div
                className={`w-px h-full ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              <button
                onClick={zoomIn}
                aria-label="Zoom in"
                className={`w-8 h-full flex items-center justify-center rounded-r-[7px] transition-colors text-sm font-mono focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/60 hover:text-black hover:bg-black/8"}`}
              >
                +
              </button>
            </div>
            <div className="relative group">
              <div
                className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs whitespace-nowrap rounded-lg border shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 ${isDark ? "border-white/12 text-white/80" : "border-black/8 text-black/70"}`}
                style={{ background: getPanelBackground(settings.theme) }}
              >
                Fit to content
                {settings.showTips && !hasTouch && <kbd className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "border-white/20 bg-white/[0.08] text-white/50" : "border-black/12 bg-black/[0.04] text-black/40"}`}>⇧ + 2</kbd>}
              </div>
              <button
                onClick={centerView}
                aria-label="Fit to content"
                className={`w-8 h-8 flex items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${isDark ? "border-white/15 text-white/70 hover:text-white hover:bg-white/10" : "border-black/15 text-black/60 hover:text-black hover:bg-black/8"}`}
                style={{ background: getPanelBackground(settings.theme) }}
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
            bottom: hasTouch
              ? "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)"
              : "1rem",
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
      {storageQuotaCanvases.has(activeCanvas) && (
        <div
          className={`fixed z-50 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium backdrop-blur-sm animate-fade-in-up ${
            isDark
              ? "bg-amber-950/80 border-amber-500/40 text-amber-200"
              : "bg-amber-50/90 border-amber-500/50 text-amber-900"
          }`}
          style={{
            bottom: hasTouch
              ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)"
              : "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2.5L14 13.5H2L8 2.5Z" />
            <line x1="8" y1="7" x2="8" y2="10" />
            <circle cx="8" cy="12" r="0.5" fill="currentColor" />
          </svg>
          Canvas full — new strokes won't survive a refresh
          <button
            onClick={() => {
              exportPng();
              setStorageQuotaCanvases((prev) => {
                const next = new Set(prev);
                next.delete(activeCanvas);
                return next;
              });
            }}
            className={`ml-0.5 px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${
              isDark
                ? "bg-amber-500/25 hover:bg-amber-500/45 text-amber-200"
                : "bg-amber-400/30 hover:bg-amber-400/55 text-amber-900"
            }`}
          >
            Export PNG
          </button>
          <button
            onClick={() =>
              setStorageQuotaCanvases((prev) => {
                const next = new Set(prev);
                next.delete(activeCanvas);
                return next;
              })
            }
            aria-label="Dismiss"
            className="opacity-50 hover:opacity-90 transition-opacity text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}
      {isSignedIn !== false &&
      (cloudCanvas.workspace || cloudCanvas.cachedWorkspaceName) ? (
        isEditingName && !hasTouch && cloudCanvas.activeId ? (
          <div className="fixed top-2 left-2 z-30 select-none flex items-center gap-1.5 overflow-hidden max-w-[min(38vw,280px)] rounded-lg px-1 py-0.5">
            <span
              className="shrink min-w-0 truncate text-[11px] font-medium tracking-wide uppercase"
              style={{
                color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {cloudCanvas.workspace?.name ?? cloudCanvas.cachedWorkspaceName}
            </span>
            <span
              className="shrink-0"
              style={{
                color: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.65rem",
              }}
            >
              /
            </span>
            <span
              className="shrink-0 text-2xl tabular-nums tracking-wider"
              style={{
                color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                fontFamily: "Caveat Brush, cursive",
              }}
            >
              {activeCanvas}
            </span>
            <input
              ref={canvasNameInputRef}
              value={canvasName}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setCanvasName(e.target.value)}
              onBlur={async () => {
                await cloudCanvas.renameCanvas(
                  cloudCanvas.activeId!,
                  canvasName,
                );
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setCanvasName(
                    cloudCanvas.activeCanvasMeta?.name ??
                      cloudCanvas.cachedCanvasName ??
                      "",
                  );
                  setIsEditingName(false);
                }
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              className="shrink min-w-0 bg-transparent border-none outline-none text-[19px]"
              style={{
                width: `${canvasName?.length ? canvasName.length + 2 : 2}ch`,
                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                fontFamily: "Caveat Brush, cursive",
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowWorkspaceSwitcher(true)}
            className="fixed top-2 left-2 z-30 select-none flex items-center gap-1.5 overflow-hidden max-w-[min(38vw,280px)] rounded-lg px-1 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            title={
              isPro
                ? "Switch workspace or canvas (⌘O)"
                : "Switch workspace or canvas"
            }
          >
            <span
              className="shrink min-w-0 truncate text-[11px] font-medium tracking-wide uppercase"
              style={{
                color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {cloudCanvas.workspace?.name ?? cloudCanvas.cachedWorkspaceName}
            </span>
            {(cloudCanvas.activeCanvasMeta || cloudCanvas.cachedCanvasName) && (
              <>
                <span
                  className="shrink-0"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.12)",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.65rem",
                  }}
                >
                  /
                </span>
                <span
                  className="shrink-0 text-2xl tabular-nums tracking-wider"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                    fontFamily: "Caveat Brush, cursive",
                  }}
                >
                  {activeCanvas}
                </span>
                {!hasTouch && (
                  <span
                    className="shrink min-w-0 truncate text-[19px]"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.3)",
                      fontFamily: "Caveat Brush, cursive",
                    }}
                  >
                    {cloudCanvas.activeCanvasMeta?.name ??
                      cloudCanvas.cachedCanvasName}
                  </span>
                )}
              </>
            )}
          </button>
        )
      ) : isSignedIn === false ? (
        <div
          className="fixed top-2 left-2 z-30 select-none flex items-center gap-1.5"
          style={{ pointerEvents: isEditingName ? "auto" : "none" }}
        >
          <div
            className="text-2xl tabular-nums tracking-wider pointer-events-none"
            style={{
              color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
              fontFamily: "Caveat Brush, cursive",
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
                  fontFamily: "Caveat Brush, cursive",
                }}
              />
            ) : (
              <span
                className="text-[19px] pointer-events-none select-none"
                style={{
                  color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                  fontFamily: "Caveat Brush, cursive",
                }}
              >
                {canvasName}
              </span>
            ))}
        </div>
      ) : null}
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
      {showOnboarding && hasTouch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to drawzilla"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
        >
          <div
            className={`w-full max-w-sm rounded-2xl border backdrop-blur-sm px-6 py-6 ${isDark ? "bg-black/80 border-white/15" : "bg-white/85 border-black/12"}`}
          >
            <div className="flex flex-col items-center mb-5">
              <img
                src="/drawzillaicon.svg"
                alt="drawzilla"
                className="w-14 h-14 object-contain mb-2"
              />
              <div className="select-none">
                <DrawzillaLogo fontSize={24} isDark={isDark} />
              </div>
            </div>
            <div
              className={`text-xs space-y-2.5 ${isDark ? "text-white/60" : "text-black/60"}`}
            >
              {[
                ["Draw", "select tool, then drag"],
                ["Undo", "2-finger tap"],
                ["Redo", "3-finger tap"],
                ["More options", "long-press a tool"],
                ["Switch canvas", "swipe toolbar"],
                ["Zoom", "pinch"],
              ].map(([action, gesture]) => (
                <div
                  key={action}
                  className="flex justify-between items-center gap-4"
                >
                  <span>{action}</span>
                  <span
                    className={`shrink-0 text-[11px] ${isDark ? "text-white/35" : "text-black/35"}`}
                  >
                    {gesture}
                  </span>
                </div>
              ))}
            </div>
            <div
              className={`text-[11px] text-center mt-5 ${isDark ? "text-white/25" : "text-black/25"}`}
            >
              Tap anywhere to start
            </div>
          </div>
        </div>
      )}
      {showOnboarding && !hasTouch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to drawzilla"
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div
            className={`px-8 py-6 rounded-lg border backdrop-blur-sm text-center max-w-xs ${isDark ? "bg-black/70 border-white/15" : "bg-white/70 border-black/15"}`}
          >
            <img
              src="/drawzillaicon.svg"
              alt="drawzilla"
              className="w-20 h-20 mx-auto mb-3 object-contain"
            />
            <div className="mb-4 select-none">
              <DrawzillaLogo fontSize={20} isDark={isDark} />
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
                  S + drag
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
              Press ? to see all shortcuts
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
          className={`fixed z-[60] flex items-center gap-2.5 px-3 py-2 rounded-xl pointer-events-none ${isPro ? "top-4 right-16" : "top-14 right-4"} ${toastFading ? "animate-toast-out" : "animate-toast-in"}`}
          style={{
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            boxShadow:
              "0 6px 24px rgba(34,197,94,0.45), 0 2px 8px rgba(0,0,0,0.2)",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4,12 9,18 20,6" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                opacity: 0.75,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Challenge complete
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginTop: 2,
                lineHeight: 1.2,
              }}
            >
              {toast.message}
            </div>
          </div>
        </div>
      )}
      {toast && toast.type !== "challenge" && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed z-[60] px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-medium shadow-lg pointer-events-none flex items-center gap-1.5 ${isPro ? "top-4 right-16" : "top-14 right-4"} ${toastFading ? "animate-toast-out" : "animate-toast-in"}`}
          style={{
            background: getPanelBackground(settings.theme),
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
            <>
              {toast.shape === "rectangle" && (
                <Square size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "circle" && (
                <Circle size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "triangle" && (
                <Triangle size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "diamond" && (
                <Diamond size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "pentagon" && (
                <Pentagon size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "hexagon" && (
                <Hexagon size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "star" && (
                <Star size={20} strokeWidth={1.75} fill="none" />
              )}
              {toast.shape === "arrow" && (
                <ArrowRight size={20} strokeWidth={1.75} />
              )}
              {toast.shape === "cloud" && (
                <Cloud size={20} strokeWidth={1.75} />
              )}
              {toast.shape === "line" && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="13" x2="13" y2="3" />
                </svg>
              )}
            </>
          )}
        </div>
      )}
      {trainingFlash && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-training-flash"
          style={{
            background: isDark ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.82)",
          }}
        >
          <div
            className="flex items-center mb-2"
            style={{ fontFamily: "Caveat Brush, cursive", fontSize: 32 }}
          >
            {(
              [
                { letter: "d", color: "#3b82f6", rotate: -6 },
                { letter: "r", color: "#ef4444", rotate: 3 },
                { letter: "a", color: "#22c55e", rotate: -4 },
                { letter: "w", color: "#eab308", rotate: 5 },
                { letter: "z", color: "#ec4899", rotate: -3 },
                { letter: "i", color: "#f97316", rotate: 4 },
                { letter: "l", color: "#8b5cf6", rotate: -5 },
                { letter: "l", color: "#06b6d4", rotate: 3 },
                { letter: "a", color: "#ef4444", rotate: -4 },
              ] as { letter: string; color: string; rotate: number }[]
            ).map((l, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginLeft: i === 0 ? 0 : 1,
                  transform: `rotate(${l.rotate}deg)`,
                }}
              >
                <span
                  style={{
                    color: l.color,
                    display: "inline-block",
                    textShadow: isDark
                      ? `0 0 16px ${l.color}66`
                      : `2px 2px 0 ${l.color}22`,
                  }}
                >
                  {l.letter}
                </span>
              </span>
            ))}
          </div>
          <div
            className="text-sm font-mono tracking-widest uppercase"
            style={{
              color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
              letterSpacing: "0.25em",
            }}
          >
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
          <div
            className="px-3 py-1 flex items-center pointer-events-none"
            style={{ fontFamily: "Caveat Brush, cursive", fontSize: 17 }}
          >
            {(
              [
                { letter: "d", color: "#3b82f6", rotate: -6 },
                { letter: "r", color: "#ef4444", rotate: 3 },
                { letter: "a", color: "#22c55e", rotate: -4 },
                { letter: "w", color: "#eab308", rotate: 5 },
                { letter: "z", color: "#ec4899", rotate: -3 },
                { letter: "i", color: "#f97316", rotate: 4 },
                { letter: "l", color: "#8b5cf6", rotate: -5 },
                { letter: "l", color: "#06b6d4", rotate: 3 },
                { letter: "a", color: "#ef4444", rotate: -4 },
              ] as { letter: string; color: string; rotate: number }[]
            ).map((l, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginLeft: i === 0 ? 0 : 2,
                  transform: `rotate(${l.rotate}deg)`,
                }}
              >
                <span
                  style={{
                    color: l.color,
                    display: "inline-block",
                    textShadow: isDark
                      ? `0 0 8px ${l.color}44`
                      : `1px 1px 0 ${l.color}22`,
                  }}
                >
                  {l.letter}
                </span>
              </span>
            ))}
            <span
              className="ml-2 text-[11px]"
              style={{
                fontFamily: "ui-monospace, monospace",
                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
              }}
            >
              training mode
            </span>
          </div>
          <div
            className="self-stretch w-px"
            style={{
              background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
            }}
          />
          <button
            onClick={() => {
              history.pushState(null, "", "/");
              setShowTraining(false);
            }}
            className="px-3 py-1 text-[11px] rounded-r-full transition-colors"
            style={{
              color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
            }}
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
          className={`fixed ${hasTouch ? "" : "bottom-4"} right-4 z-30 w-64 rounded-xl border backdrop-blur-md shadow-lg overflow-hidden animate-toast-in`}
          style={{
            background: isDark ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.92)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
            ...(hasTouch
              ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }
              : {}),
          }}
        >
          {/* gradient top bar */}
          <div
            className="h-0.5"
            style={{ background: "linear-gradient(90deg, #3b82f6, #ec4899)" }}
          />
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div
                className="flex items-center"
                style={{ fontFamily: "Caveat Brush, cursive", fontSize: 17 }}
              >
                {(
                  [
                    { letter: "d", color: "#3b82f6", rotate: -6 },
                    { letter: "r", color: "#ef4444", rotate: 3 },
                    { letter: "a", color: "#22c55e", rotate: -4 },
                    { letter: "w", color: "#eab308", rotate: 5 },
                    { letter: "z", color: "#ec4899", rotate: -3 },
                    { letter: "i", color: "#f97316", rotate: 4 },
                    { letter: "l", color: "#8b5cf6", rotate: -5 },
                    { letter: "l", color: "#06b6d4", rotate: 3 },
                    { letter: "a", color: "#ef4444", rotate: -4 },
                  ] as { letter: string; color: string; rotate: number }[]
                ).map((l, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginLeft: i === 0 ? 0 : 2,
                      transform: `rotate(${l.rotate}deg)`,
                    }}
                  >
                    <span
                      style={{
                        color: l.color,
                        display: "inline-block",
                        textShadow: isDark
                          ? `0 0 8px ${l.color}44`
                          : `1px 1px 0 ${l.color}22`,
                      }}
                    >
                      {l.letter}
                    </span>
                  </span>
                ))}
                <span
                  className="text-[11px] font-mono ml-1.5"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                  }}
                >
                  training
                </span>
              </div>
              <button
                onClick={() => dismissNudge(true)}
                className="shrink-0 mt-0.5 transition-opacity opacity-30 hover:opacity-60"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
            </div>
            <p
              className="text-[11px] leading-relaxed mb-3"
              style={{
                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
              }}
            >
              Learn all the tools and shortcuts with step-by-step challenges.
            </p>
            <button
              onClick={() => {
                dismissNudge(true);
                openTraining();
              }}
              className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                background: "linear-gradient(90deg, #3b82f620, #ec489920)",
                color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                border: "1px solid #3b82f630",
              }}
            >
              Start training →
            </button>
          </div>
        </div>
      )}
      {showStash && (
        <StashPanel
          items={stashItems}
          isDark={isDark}
          theme={settings.theme}
          hasTouch={hasTouch}
          onClose={() => setShowStash(false)}
          onDrop={(item) => {
            window.dispatchEvent(
              new CustomEvent("drawtool:drop-stash-item", {
                detail: { strokes: item.strokes, savedDark: item.savedDark },
              }),
            );
            setShowStash(false);
            showToast({ type: "text", message: `"${item.name}" dropped` });
          }}
          onDelete={(id) => {
            setStashItems((prev) => {
              const next = prev.filter((i) => i.id !== id);
              saveStash(next);
              return next;
            });
          }}
          onRename={(id, name) => {
            setStashItems((prev) => {
              const next = prev.map((i) => (i.id === id ? { ...i, name } : i));
              saveStash(next);
              return next;
            });
          }}
          onReorder={(fromId, toId) => {
            setStashItems((prev) => {
              const fromIdx = prev.findIndex((i) => i.id === fromId);
              let toIdx = prev.findIndex((i) => i.id === toId);
              if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx)
                return prev;
              const next = [...prev];
              const [item] = next.splice(fromIdx, 1);
              if (toIdx > fromIdx) toIdx--;
              next.splice(toIdx, 0, item);
              saveStash(next);
              return next;
            });
          }}
          onImport={(imported) => {
            setStashItems((prev) => {
              const existingIds = new Set(prev.map((i) => i.id));
              const fresh = imported.filter((i) => !existingIds.has(i.id));
              const next = [...fresh, ...prev];
              saveStash(next);
              return next;
            });
            showToast({ type: "text", message: "Stash imported" });
          }}
        />
      )}
      {pendingWorkspaceImport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
        >
          <div
            className={`w-full max-w-sm rounded-2xl border px-6 py-5 ${isDark ? "bg-black/80 border-white/15" : "bg-white/90 border-black/12"}`}
          >
            <p
              className={`text-[14px] font-semibold mb-1 ${isDark ? "text-white" : "text-black"}`}
            >
              Workspace has {pendingWorkspaceImport.total} canvases
            </p>
            <p
              className={`text-[13px] mb-1 ${isDark ? "text-white/60" : "text-black/55"}`}
            >
              Your free plan supports {canvasLimitImportRef.current}. Only the
              first {canvasLimitImportRef.current} will be imported.
            </p>
            <a
              href="https://unleash.drawzil.la"
              className="inline-block text-[13px] text-[#3b82f6] hover:underline mb-5"
            >
              Upgrade to import all {pendingWorkspaceImport.total} →
            </a>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingWorkspaceImport(null)}
                className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/8 text-black hover:bg-black/12"}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  processWorkspaceFile(
                    pendingWorkspaceImport.file,
                    canvasLimitImportRef.current,
                  );
                  setPendingWorkspaceImport(null);
                }}
                className="flex-1 py-2 rounded-xl text-[13px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
              >
                Import {canvasLimitImportRef.current}
              </button>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            importMode === "workspace" ? "Import workspace" : "Import canvas"
          }
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
              {importMode === "workspace"
                ? "Import workspace"
                : "Import canvas"}
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
                  if (importMode === "workspace") processWorkspaceFile(file);
                  else if (activeCanvas <= canvasLimit) processImportFile(file);
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
      {settings.showTips && !hasTouch && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none flex flex-wrap items-center gap-px justify-center"
          style={{
            top: isWide ? 32 : 40,
            background: getPanelBackground(settings.theme),
            borderRadius: 8,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            backdropFilter: "blur(8px)",
            padding: "3px 3px",
            maxWidth: "min(calc(100vw - 40px), 900px)",
          }}
        >
          {(
            [
              {
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
                  </svg>
                ),
                label: `${mod} + drag`,
              },
              {
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="2 2.5"
                  >
                    <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
                  </svg>
                ),
                label: `${shift} + drag`,
              },
              {
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <line x1="3" y1="13" x2="13" y2="3" />
                  </svg>
                ),
                label: `${mod} + ${shift} + drag`,
              },
              {
                icon: (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <defs>
                      <linearGradient id="tip-eg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="50%" stopColor="#89CFF0" />
                        <stop offset="50%" stopColor="#FA8072" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="2"
                      y="4"
                      width="12"
                      height="8"
                      rx="1.5"
                      transform="rotate(-15 8 8)"
                      fill="url(#tip-eg)"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                  </svg>
                ),
                label: `${alt} + drag`,
              },
              {
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3" width="12" height="10" rx="1" />
                  </svg>
                ),
                label: "S + drag",
              },
              {
                icon: (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <text
                      x="8"
                      y="13"
                      textAnchor="middle"
                      fill="currentColor"
                      stroke="none"
                      fontSize="14"
                      fontWeight="700"
                      fontFamily="Georgia,serif"
                    >
                      A
                    </text>
                  </svg>
                ),
                label: "T",
              },
              {
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 2 L4 12 L7 9.5 L9 13.5 L10.5 12.8 L8.5 8.8 L12 8.8 Z" />
                  </svg>
                ),
                label: "Hold V",
              },
              {
                icon: <Hand size={12} strokeWidth={1.5} />,
                label: "Space + drag",
              },
              {
                icon: (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
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
                ),
                label: "Q / L + drag",
              },
            ] as { icon: ReactNode; label: string }[]
          ).map(({ icon, label }, i, arr) => (
            <span key={i} className="flex items-center">
              <span
                className="flex items-center gap-1 px-2 py-0.5 whitespace-nowrap"
                style={{
                  color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                  fontSize: 10,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {icon}
                {label}
              </span>
              {i < arr.length - 1 && (
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                    display: "inline-block",
                  }}
                />
              )}
            </span>
          ))}
        </div>
      )}
      {settings.showTips && !hasTouch && (
        <div
          className="fixed bottom-4 right-4 z-20 pointer-events-none select-none"
          style={{ maxWidth: "18rem" }}
        >
          <div
            style={{
              opacity: tipVisible ? 1 : 0,
              transition: "opacity 0.4s ease",
              color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              textAlign: "right",
            }}
          >
            {kbTips[tipOrderRef.current![tipIndex]]}
          </div>
        </div>
      )}
      {settings.showTips && !hasTouch && selectHintVisible && !hasSelection && (
        <div
          className={`fixed ${isWide ? "bottom-4" : "bottom-14"} left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none`}
          style={{
            background: getPanelBackground(settings.theme),
            borderRadius: 8,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            backdropFilter: "blur(8px)",
            padding: "4px 10px",
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
            maxWidth: "calc(100vw - 2rem)",
            overflowX: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          Click to select &nbsp;·&nbsp; Drag to box-select &nbsp;·&nbsp;{" "}
          <K>{shift}</K> + drag for fully enclosed only &nbsp;·&nbsp;{" "}
          <K>{shift}</K> + click to add &nbsp;·&nbsp; <K>V</K>
          <K>V</K> to lock &nbsp;·&nbsp; <K>Esc</K> to exit
        </div>
      )}
    </>
  );
}
