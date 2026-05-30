import React, { useState, useRef, useEffect } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton, useUser, useClerk } from "@clerk/clerk-react";
import CanvasReorderPanel from "./CanvasReorderPanel";
import type {
  Settings,
  Theme,
  TextSize,
  GridType,
  FontFamily,
  TextAlign,
  FillStyle,
  ClickTool,
} from "../hooks/useSettings";
import ShortcutsPanel from "./ShortcutsPanel";
import {
  CONFIRM_CLEAR_STROKE_THRESHOLD,
  getPanelBackground,
} from "../canvas/canvasUtils";
import type { ShareLink } from "../hooks/useCloudCanvas";
import type { Subscription } from "../hooks/useUserPlan";

function formatExpiry(expiresAt: number): string {
  const secs = expiresAt - Math.floor(Date.now() / 1000)
  if (secs <= 0) return 'expired'
  const days = Math.ceil(secs / 86400)
  if (days > 1) return `${days}d left`
  if (days === 1) return '1d left'
  const hours = Math.floor(secs / 3600)
  return hours > 0 ? `${hours}h left` : 'expires soon'
}

function expiryUrgency(expiresAt: number): 'ok' | 'warn' | 'urgent' {
  const days = (expiresAt - Math.floor(Date.now() / 1000)) / 86400
  if (days <= 1) return 'urgent'
  if (days <= 3) return 'warn'
  return 'ok'
}


function Tooltip({ label }: { label: string }) {
  return (
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-0 group-hover:delay-500 bg-black/80 text-white z-50">
      {label}
    </span>
  );
}

function isDarkTheme(theme: Theme): boolean {
  return (
    theme === "dark" ||
    theme === "midnight" ||
    theme === "lumber" ||
    theme === "slate"
  );
}

const CLICK_TOOL_OPTIONS: {
  value: ClickTool;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "draw",
    label: "Draw",
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
  },
  {
    value: "dashed",
    label: "Dashed",
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
  },
  {
    value: "pan",
    label: "Pan",
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
        <path d="M5,8 L2,8 M14,8 L11,8 M8,5 L8,2 M8,14 L8,11" />
        <path d="M3,8 L5,6.5 M3,8 L5,9.5 M13,8 L11,6.5 M13,8 L11,9.5 M8,3 L6.5,5 M8,3 L9.5,5 M8,13 L6.5,11 M8,13 L9.5,11" />
      </svg>
    ),
  },
  {
    value: "laser",
    label: "Laser",
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" fill="#ff3030" fillOpacity="0.9" />
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
  },
  {
    value: "erase",
    label: "Erase",
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <defs>
          <linearGradient id="eg-mb" x1="0" y1="0" x2="1" y2="0">
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
          fill="url(#eg-mb)"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </svg>
    ),
  },
];

function ClickToolPicker({
  value,
  onChange,
  isDark,
}: {
  value: ClickTool;
  onChange: (tool: ClickTool) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = CLICK_TOOL_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-xs rounded-md px-1.5 py-1 transition-colors ${
          isDark
            ? "bg-white/10 text-white/80 hover:bg-white/[0.15]"
            : "bg-black/[0.07] text-black/70 hover:bg-black/[0.11]"
        }`}
      >
        {current.icon}
        <span className="leading-none">{current.label}</span>
        <svg
          width="7"
          height="5"
          viewBox="0 0 7 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-40 ml-0.5"
        >
          <path d="M1 1L3.5 3.5L6 1" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute bottom-full mb-1.5 right-0 z-50 rounded-lg py-1 min-w-[110px] shadow-xl border ${
            isDark
              ? "bg-[#1e1e1e] border-white/10"
              : "bg-white border-black/[0.08]"
          }`}
        >
          {CLICK_TOOL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-xs transition-colors ${
                opt.value === value
                  ? isDark
                    ? "bg-white/[0.10] text-white"
                    : "bg-black/[0.06] text-black"
                  : isDark
                    ? "text-white/55 hover:bg-white/[0.06] hover:text-white/80"
                    : "text-black/50 hover:bg-black/[0.04] hover:text-black/70"
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccordionSection({
  label,
  icon,
  open,
  onToggle,
  isDark,
  children,
  action,
  tip,
  dim,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  isDark: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
  tip?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggle}
          className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            isDark
              ? `${open ? "bg-white/[0.08] text-white/80" : "bg-white/5 " + (dim ? "text-white/35" : "text-white/55")} hover:bg-white/[0.11] ` +
                (dim ? "hover:text-white/60" : "hover:text-white/85")
              : `${open ? "bg-black/[0.07] text-black/70" : "bg-black/[0.04] " + (dim ? "text-black/30" : "text-black/50")} hover:bg-black/[0.09] ` +
                (dim ? "hover:text-black/55" : "hover:text-black/75")
          }`}
        >
          <span className="flex items-center gap-2">
            {icon}
            {label}
          </span>
          <span className="flex items-center gap-2">
            {tip}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            >
              <path d="M3.5 1.5L7 5L3.5 8.5" />
            </svg>
          </span>
        </button>
        {action}
      </div>
      {open && <div className="mt-1.5 px-1 pb-1">{children}</div>}
    </div>
  );
}

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  onExport?: (format: "png" | "svg", transparent: boolean) => void;
  exportFormat: "png" | "svg";
  exportTransparentBg: boolean;
  onSetExportFormat: (f: "png" | "svg") => void;
  onSetExportTransparentBg: (v: boolean) => void;
  hasTouch: boolean;
  activeCanvas: number;
  onSwitchCanvas: (n: number) => void;
  onReorderCanvases: (newOrder: number[]) => void;
  onToggleFullscreen: () => void;
  onResetView: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  exportIncludeImages: boolean;
  onSetExportIncludeImages: (v: boolean) => void;
  onStartTraining: () => void;
  stashCount: number;
  selectionCount: number;
  onExportSelection: (transparent: boolean) => void;
  canvasLimit: number;
  isPro: boolean;
  cloudCanvases?: { id: string; name: string; position: number }[];
  activeCloudCanvasId?: string | null;
  onReorderCloud?: (ids: string[]) => Promise<boolean>;
  canvasShares?: ShareLink[];
  existingShareWorkspaceUrl?: string | null;
  onShareCanvas?: () => Promise<(ShareLink & { url: string }) | null>;
  onDeleteShare?: (token: string) => Promise<boolean>;
  onShareWorkspace?: () => Promise<string | null>;
  onUnshareWorkspace?: () => Promise<boolean>;
  subscription?: Subscription | null;
  onExportWorkspacesZip?: () => void;
  onResubscribe?: () => void;
};

export default function Menu({
  settings,
  updateSettings,
  onExport,
  exportFormat,
  exportTransparentBg,
  onSetExportFormat,
  onSetExportTransparentBg,
  hasTouch,
  activeCanvas,
  onSwitchCanvas,
  onReorderCanvases,
  onToggleFullscreen,
  onResetView,
  onExportData,
  onImportData,
  onExportWorkspace,
  onImportWorkspace,
  exportIncludeImages,
  onSetExportIncludeImages,
  onStartTraining,
  stashCount,
  selectionCount,
  onExportSelection,
  canvasLimit,
  isPro,
  cloudCanvases,
  activeCloudCanvasId,
  onReorderCloud,
  canvasShares,
  existingShareWorkspaceUrl,
  onShareCanvas,
  onDeleteShare,
  onShareWorkspace,
  onUnshareWorkspace,
  subscription,
  onExportWorkspacesZip,
  onResubscribe,
}: Props) {
  const [open, setOpen] = useState(false);
  const isWritingRef = useRef(false);
  const [logoAnimate, setLogoAnimate] = useState(false);
  const hasWavedRef = useRef(!!sessionStorage.getItem("drawtool-logo-waved"));
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [shareWorkspaceUrl, setShareWorkspaceUrl] = useState<string | null>(existingShareWorkspaceUrl ?? null);
  const [sharing, setSharing] = useState<'canvas' | 'workspace' | null>(null);
  const [copiedShareToken, setCopiedShareToken] = useState<string | null>(null);
  const copiedShareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setShareWorkspaceUrl(existingShareWorkspaceUrl ?? null); }, [existingShareWorkspaceUrl]);
  const [clearWipe, setClearWipe] = useState(0);
  const [clearConfirming, setClearConfirming] = useState(false);
  const clearConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const isMac = /mac/i.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";

  const isDark = isDarkTheme(settings.theme);
  const { user } = useUser();
  const { signOut } = useClerk();
  const waveStyle = `@keyframes dtWave {
    0%   { transform: translateY(0) scale(1); }
    35%  { transform: translateY(-7px) scale(1.2); }
    65%  { transform: translateY(1px) scale(0.95); }
    100% { transform: translateY(0) scale(1); }
  }`;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:menu-state", { detail: open }),
    );
  }, [open]);

  useEffect(() => {
    const onToggle = () => {
      if (!hasWavedRef.current) {
        hasWavedRef.current = true;
        sessionStorage.setItem("drawtool-logo-waved", "1");
        setLogoAnimate(true);
      }
      setOpen((o) => {
        if (o) {
          setShowHelp(false);
          setShowAbout(false);
          setShowExport(false);
          setShowReorder(false);
          setClearWipe(0);
          setLogoAnimate(false);
        }
        return !o;
      });
    };
    const onClose = () => {
      setOpen(false);
      setShowHelp(false);
      setShowAbout(false);
      setShowExport(false);
      setShowReorder(false);
    };
    const onOpenShortcuts = () => {
      setOpen(false);
      setShowHelp(false);
      setShowAbout(false);
      setShowExport(false);
      setShowKeysModal(true);
    };
    const onOpenCanvasManager = () => {
      setOpen(false);
      setShowReorder(true);
    };
    window.addEventListener("drawtool:toggle-menu", onToggle);
    window.addEventListener("drawtool:close-menu", onClose);
    window.addEventListener("drawtool:open-shortcuts", onOpenShortcuts);
    window.addEventListener("drawtool:open-canvas-manager", onOpenCanvasManager);
    return () => {
      window.removeEventListener("drawtool:toggle-menu", onToggle);
      window.removeEventListener("drawtool:close-menu", onClose);
      window.removeEventListener("drawtool:open-shortcuts", onOpenShortcuts);
      window.removeEventListener("drawtool:open-canvas-manager", onOpenCanvasManager);
    };
  }, []);

  useEffect(() => {
    const onWriting = (e: Event) => {
      isWritingRef.current = (e as CustomEvent).detail as boolean;
    };
    window.addEventListener("drawtool:writing", onWriting);
    return () => window.removeEventListener("drawtool:writing", onWriting);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("drawtool:shortcuts-modal", { detail: showKeysModal }));
    if (!showKeysModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setShowKeysModal(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [showKeysModal]);

  useEffect(() => {
    if (!open && !showReorder) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isWritingRef.current) {
        setOpen(false);
        setShowHelp(false);
        setShowAbout(false);
        setShowExport(false);
        setShowReorder(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, showReorder]);

  const closeMenu = () => {
    setOpen(false);
    setShowHelp(false);
    setShowAbout(false);
    setShowExport(false);
    setShowReorder(false);
    setClearWipe(0);
    setClearConfirming(false);
    if (clearConfirmTimerRef.current) {
      clearTimeout(clearConfirmTimerRef.current);
      clearConfirmTimerRef.current = null;
    }
  };

  const palette = [
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
  ];

  return (
    <>
      {showReorder && (
        <CanvasReorderPanel
          activeCanvas={activeCanvas}
          isDark={isDark}
          theme={settings.theme}
          onReorderCanvases={onReorderCanvases}
          onSwitchCanvas={onSwitchCanvas}
          onClose={() => setShowReorder(false)}
          cloudCanvases={cloudCanvases}
          activeCloudCanvasId={activeCloudCanvasId}
          onReorderCloud={onReorderCloud}
        />
      )}
      {showKeysModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowKeysModal(false)}
          />
          <div
            className={`relative z-10 rounded-xl border w-[90vw] max-w-[1400px] flex flex-col max-h-[90vh] ${
              settings.theme === "midnight"
                ? "bg-[rgba(15,15,30,0.97)] border-white/15"
                : isDark
                  ? "bg-black/97 border-white/15"
                  : "bg-white/97 border-black/15"
            }`}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <span
                className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? "text-white/30" : "text-black/30"}`}
              >
                Keyboard shortcuts
              </span>
              <button
                onClick={() => setShowKeysModal(false)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? "text-white/50 hover:text-white/80 hover:bg-white/10" : "text-black/40 hover:text-black/70 hover:bg-black/[0.07]"}`}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <ShortcutsPanel isDark={isDark} modal isPro={isPro} />
            </div>
          </div>
        </div>
      )}
      <div
        ref={menuRef}
        className="fixed top-4 right-4 z-50 flex flex-col items-end"
      >
        <button
            aria-label="Menu"
            aria-expanded={open}
            onClick={(e) => {
              if (!open && !hasWavedRef.current) {
                hasWavedRef.current = true;
                sessionStorage.setItem("drawtool-logo-waved", "1");
                setLogoAnimate(true);
              }
              setOpen((o) => {
                if (o) {
                  setShowAbout(false);
                  setClearWipe(0);
                  setLogoAnimate(false);
                }
                return !o;
              });
              (e.currentTarget as HTMLElement).blur();
            }}
            className={`w-[38px] h-[38px] flex items-center justify-center rounded-lg border backdrop-blur-sm transition-all duration-200 outline-none focus:outline-none ${open ? (isDark ? "border-white/30 text-white" : "border-black/30 text-black") : isDark ? "border-white/20 text-white/70 hover:text-white" : "border-black/20 text-black/70 hover:text-black"}`}
            style={{ background: getPanelBackground(settings.theme) }}
          >
            <span className="relative flex items-center justify-center w-full h-full">
              <span
                className={`absolute inset-[15%] transition-all duration-200 ${open ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"}`}
              >
                <img
                  src="/drawzilla-simplifed.svg"
                  alt=""
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </span>
              <span
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${open ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="2" y1="2.5" x2="14" y2="13.5" />
                  <line x1="14" y1="2.5" x2="2" y2="13.5" />
                </svg>
              </span>
            </span>
        </button>

        {open && (
          <nav
            aria-label="Settings menu"
            className={`mt-2 p-4 rounded-xl border backdrop-blur-sm shadow-2xl w-[min(340px,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden ${hasTouch ? "max-h-[calc(100dvh-8rem)]" : "max-h-[calc(100vh-8rem)]"} ${isDark ? "border-white/15" : "border-black/15"}`}
            style={{ background: getPanelBackground(settings.theme) }}
          >
            <style>{waveStyle}</style>
            <style>{`@keyframes dtWave {
              0%   { transform: translateY(0) scale(1); }
              35%  { transform: translateY(-7px) scale(1.2); }
              65%  { transform: translateY(1px) scale(0.95); }
              100% { transform: translateY(0) scale(1); }
            }`}</style>
            <a
              href="/"
              className="text-3xl mb-3 text-center select-none block"
              style={{
                fontFamily: "Caveat Brush, cursive",
                textDecoration: "none",
              }}
            >
              {[
                { letter: "d", color: "#3b82f6", rotate: -6 },
                { letter: "r", color: "#ef4444", rotate: 3 },
                { letter: "a", color: "#22c55e", rotate: -4 },
                { letter: "w", color: "#eab308", rotate: 5 },
                { letter: "z", color: "#ec4899", rotate: -3 },
                { letter: "i", color: "#f97316", rotate: 4 },
                { letter: "l", color: "#8b5cf6", rotate: -5 },
                { letter: "l", color: "#06b6d4", rotate: 3 },
                { letter: "a", color: "#ef4444", rotate: -4 },
              ].map((l, i) => (
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
                      ...(logoAnimate
                        ? {
                            animation: `dtWave 0.55s ease both ${i * 60}ms`,
                          }
                        : {}),
                    }}
                  >
                    {l.letter}
                  </span>
                </span>
              ))}
            </a>
            {isPro && (
              <div className="text-center -mt-3 mb-3">
                <span className="animate-unleashed text-[10px] font-black tracking-widest">UNLEASHED</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-baseline gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  Line thickness
                </span>
                {settings.showTips && (
                  <>
                    <span
                      className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                    >
                      {"{ or }"}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                    >
                      {mod} + drag
                    </span>
                  </>
                )}
              </span>
              <span
                className={`text-xs tabular-nums ${isDark ? "text-white/50" : "text-black/50"}`}
              >
                {settings.lineWidth}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 4, 6, 8, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => updateSettings({ lineWidth: n })}
                  aria-label={`Line thickness ${n}`}
                  aria-pressed={settings.lineWidth === n}
                  className="flex-1 flex items-center justify-center py-1 group"
                >
                  <div
                    className={`rounded-full transition-all duration-150 ${settings.lineWidth >= n ? "" : isDark ? "group-hover:!bg-white/30" : "group-hover:!bg-black/25"}`}
                    style={{
                      width: `${4 + n * 2}px`,
                      height: `${4 + n * 2}px`,
                      background:
                        settings.lineWidth >= n
                          ? isDark
                            ? "rgba(255,255,255,0.85)"
                            : "rgba(0,0,0,0.8)"
                          : isDark
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(0,0,0,0.12)",
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-5">
              <span className="flex items-baseline gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  Dash gap
                </span>
                {settings.showTips && (
                  <span
                    className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                  >
                    ⇧ + drag
                  </span>
                )}
              </span>
              <span
                className={`text-xs tabular-nums ${isDark ? "text-white/50" : "text-black/50"}`}
              >
                {settings.dashGap}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 4, 6, 8, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => updateSettings({ dashGap: n })}
                  aria-label={`Dash gap ${n}`}
                  aria-pressed={settings.dashGap === n}
                  className="flex-1 flex items-center justify-center py-1 group"
                >
                  <div
                    className={`rounded transition-all duration-150 ${settings.dashGap >= n ? "" : isDark ? "group-hover:!bg-white/30" : "group-hover:!bg-black/25"}`}
                    style={{
                      width: `${4 + n * 2.8}px`,
                      height: 4,
                      borderRadius: 2,
                      background:
                        settings.dashGap >= n
                          ? isDark
                            ? "rgba(255,255,255,0.85)"
                            : "rgba(0,0,0,0.8)"
                          : isDark
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(0,0,0,0.12)",
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-baseline gap-2">
              <div
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Color
              </div>
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  {"[ or ]"}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 mt-1.5 justify-center">
              {palette.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("drawtool:set-color", { detail: color }),
                    )
                  }
                  aria-label={`Color ${color}`}
                  aria-pressed={settings.lineColor === color}
                  className="w-[18px] h-[18px] shrink-0 rounded-full border-2 transition-transform focus:outline-none"
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
                      settings.lineColor === color ? "scale(1.2)" : undefined,
                  }}
                />
              ))}
            </div>

            {!hasTouch && (
              <>
                <div className="mt-4 flex items-baseline gap-2">
                  <div
                    className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                  >
                    Text size
                  </div>
                  {settings.showTips && (
                    <>
                      <span
                        className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                      >
                        T
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                      >
                        ⇧ + T
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
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
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <div
                    className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                  >
                    Font
                  </div>
                  {settings.showTips && (
                    <span
                      className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                    >
                      ⇧ + Y
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {(
                    [
                      { key: "caveat", label: "Abc", css: "'Caveat', cursive" },
                      { key: "comic", label: "Abc", css: "'Bangers', cursive" },
                      {
                        key: "cartoon",
                        label: "Abc",
                        css: "'Boogaloo', cursive",
                      },
                      {
                        key: "sans",
                        label: "Abc",
                        css: "system-ui, -apple-system, sans-serif",
                      },
                      { key: "serif", label: "Abc", css: "Georgia, serif" },
                      {
                        key: "mono",
                        label: "Abc",
                        css: "ui-monospace, 'Courier New', monospace",
                      },
                    ] as { key: FontFamily; label: string; css: string }[]
                  ).map(({ key, label, css }) => (
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
                      className={`flex-1 flex items-center justify-center py-1 rounded text-base transition-all duration-150 relative group ${
                        settings.fontFamily === key
                          ? isDark
                            ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                            : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                          : isDark
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      <Tooltip
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                      />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-2.5">
                  {/* Bold */}
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
                          ? "text-white/40 hover:text-white/60"
                          : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    B
                  </button>
                  {/* Italic */}
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
                          ? "text-white/40 hover:text-white/60"
                          : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    I
                  </button>
                  {/* Align Left */}
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("drawtool:text-align", {
                          detail: "left" as TextAlign,
                        }),
                      )
                    }
                    aria-label="Align left"
                    aria-pressed={settings.textAlign === "left"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "left"
                        ? isDark
                          ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "text-white/40 hover:text-white/60"
                          : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="1" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="1" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                  {/* Align Center */}
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("drawtool:text-align", {
                          detail: "center" as TextAlign,
                        }),
                      )
                    }
                    aria-label="Align center"
                    aria-pressed={settings.textAlign === "center"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "center"
                        ? isDark
                          ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "text-white/40 hover:text-white/60"
                          : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="3" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="2" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                  {/* Align Right */}
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("drawtool:text-align", {
                          detail: "right" as TextAlign,
                        }),
                      )
                    }
                    aria-label="Align right"
                    aria-pressed={settings.textAlign === "right"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "right"
                        ? isDark
                          ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "text-white/40 hover:text-white/60"
                          : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="5" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="3" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              <div
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Shape
              </div>
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  Hold S + drag
                </span>
              )}
            </div>
            <div className="flex gap-1.5 mt-1 justify-center">
              {(
                [
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
                ] as const
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSettings({ activeShape: s })}
                  aria-label={s.charAt(0).toUpperCase() + s.slice(1)}
                  aria-pressed={settings.activeShape === s}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none relative group ${
                    settings.activeShape === s
                      ? isDark
                        ? "bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]/50"
                        : "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40"
                      : isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-black/10"
                  }`}
                >
                  <Tooltip label={s.charAt(0).toUpperCase() + s.slice(1)} />
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={
                      settings.activeShape === s
                        ? isDark
                          ? "#93c5fd"
                          : "#3b82f6"
                        : isDark
                          ? "white"
                          : "black"
                    }
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeOpacity={settings.activeShape === s ? 1 : 0.5}
                  >
                    {s === "line" && (
                      <line
                        x1="3"
                        y1="13"
                        x2="13"
                        y2="3"
                        strokeLinecap="round"
                      />
                    )}
                    {s === "rectangle" && (
                      <rect x="2" y="3" width="12" height="10" rx="0.5" />
                    )}
                    {s === "circle" && <circle cx="8" cy="8" r="6" />}
                    {s === "triangle" && <polygon points="8,2 14,14 2,14" />}
                    {s === "diamond" && <polygon points="8,1 15,8 8,15 1,8" />}
                    {s === "pentagon" && (
                      <polygon points="8,2 14.5,6.5 12,14 4,14 1.5,6.5" />
                    )}
                    {s === "hexagon" && (
                      <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" />
                    )}
                    {s === "star" && (
                      <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />
                    )}
                    {s === "arrow" && (
                      <>
                        <line x1="2" y1="8" x2="12" y2="8" />
                        <polyline
                          points="9,5 12,8 9,11"
                          strokeLinecap="round"
                        />
                      </>
                    )}
                    {s === "cloud" && (
                      <path d="M 4.8,12 H 11.2 C 12.9,12 14.3,10.8 14.3,9.3 C 14.3,7.9 13.3,6.9 12,6.7 C 11.6,5.2 10.3,4.1 8.6,4.1 C 7.1,4.1 5.9,5 5.3,6.3 C 3.7,6.5 2.5,7.7 2.5,9.2 C 2.5,10.8 3.7,12 4.8,12 Z" />
                    )}
                  </svg>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <div
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Fill
              </div>
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  Hold F + S + drag
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {(["solid", "dots", "hatch", "crosshatch"] as FillStyle[]).map(
                (f) => (
                  <button
                    key={String(f)}
                    onClick={() => updateSettings({ shapeFill: f })}
                    aria-label={`Fill: ${f}`}
                    aria-pressed={settings.shapeFill === f}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none relative group ${
                      settings.shapeFill === f
                        ? isDark
                          ? "bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "hover:bg-white/10"
                          : "hover:bg-black/10"
                    }`}
                  >
                    <Tooltip label={f.charAt(0).toUpperCase() + f.slice(1)} />
                    {f === "solid" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={
                          settings.shapeFill === "solid"
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        opacity={settings.shapeFill === "solid" ? 1 : 0.5}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          fill={
                            settings.shapeFill === "solid"
                              ? isDark
                                ? "#93c5fd"
                                : "#3b82f6"
                              : isDark
                                ? "white"
                                : "black"
                          }
                          fillOpacity="0.35"
                        />
                      </svg>
                    )}
                    {f === "dots" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={
                          settings.shapeFill === "dots"
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        opacity={settings.shapeFill === "dots" ? 1 : 0.5}
                      >
                        <rect x="2" y="2" width="12" height="12" rx="1.5" />
                        <circle
                          cx="6"
                          cy="6.5"
                          r="1.2"
                          fill={
                            settings.shapeFill === "dots"
                              ? isDark
                                ? "#93c5fd"
                                : "#3b82f6"
                              : isDark
                                ? "white"
                                : "black"
                          }
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="6.5"
                          r="1.2"
                          fill={
                            settings.shapeFill === "dots"
                              ? isDark
                                ? "#93c5fd"
                                : "#3b82f6"
                              : isDark
                                ? "white"
                                : "black"
                          }
                          stroke="none"
                        />
                        <circle
                          cx="6"
                          cy="10.5"
                          r="1.2"
                          fill={
                            settings.shapeFill === "dots"
                              ? isDark
                                ? "#93c5fd"
                                : "#3b82f6"
                              : isDark
                                ? "white"
                                : "black"
                          }
                          stroke="none"
                        />
                        <circle
                          cx="10"
                          cy="10.5"
                          r="1.2"
                          fill={
                            settings.shapeFill === "dots"
                              ? isDark
                                ? "#93c5fd"
                                : "#3b82f6"
                              : isDark
                                ? "white"
                                : "black"
                          }
                          stroke="none"
                        />
                      </svg>
                    )}
                    {f === "hatch" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={
                          settings.shapeFill === "hatch"
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                        strokeLinejoin="round"
                        opacity={settings.shapeFill === "hatch" ? 1 : 0.5}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          strokeWidth="1.5"
                        />
                        {/* 3 parallel ↘ lines */}
                        <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                        <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.1" />
                        <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                      </svg>
                    )}
                    {f === "crosshatch" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={
                          settings.shapeFill === "crosshatch"
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                        strokeLinejoin="round"
                        opacity={settings.shapeFill === "crosshatch" ? 1 : 0.5}
                      >
                        <rect
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          rx="1.5"
                          strokeWidth="1.5"
                        />
                        {/* ↘ lines */}
                        <line x1="7" y1="2" x2="14" y2="9" strokeWidth="1.1" />
                        <line x1="2" y1="7" x2="9" y2="14" strokeWidth="1.1" />
                        {/* ↗ lines */}
                        <line x1="9" y1="2" x2="2" y2="9" strokeWidth="1.1" />
                        <line x1="14" y1="7" x2="7" y2="14" strokeWidth="1.1" />
                      </svg>
                    )}
                  </button>
                ),
              )}
              <div
                className={`w-px h-4 mx-0.5 ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={settings.fillOpacity}
                  onChange={(e) =>
                    updateSettings({ fillOpacity: Number(e.target.value) })
                  }
                  className="flex-1 min-w-0"
                  style={{ accentColor: isDark ? "#93c5fd" : "#3b82f6" }}
                />
                <span
                  className={`text-[10px] tabular-nums w-6 text-right ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  {settings.fillOpacity}%
                </span>
              </div>
            </div>

            <div
              className={`mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              <span>Style</span>
              <span className="flex items-baseline gap-1.5">
                Grid
                {settings.showTips && (
                  <span
                    className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                  >
                    G
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {(["rounded", "sharp"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ shapeCorners: c })}
                  aria-pressed={settings.shapeCorners === c}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none relative group ${
                    settings.shapeCorners === c
                      ? isDark
                        ? "bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]/50"
                        : "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40"
                      : isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-black/10"
                  }`}
                >
                  <Tooltip label={c === "rounded" ? "Rounded" : "Sharp"} />
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={
                      settings.shapeCorners === c
                        ? isDark
                          ? "#93c5fd"
                          : "#3b82f6"
                        : isDark
                          ? "white"
                          : "black"
                    }
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    opacity={settings.shapeCorners === c ? 1 : 0.5}
                  >
                    {c === "rounded" ? (
                      <rect x="2" y="2" width="12" height="12" rx="3" />
                    ) : (
                      <rect x="2" y="2" width="12" height="12" rx="0" />
                    )}
                  </svg>
                </button>
              ))}
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  E
                </span>
              )}
              <div
                className={`w-px h-4 mx-0.5 ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              {([false, true] as const).map((on) => (
                <button
                  key={String(on)}
                  onClick={() => updateSettings({ pressureSensitivity: on })}
                  aria-pressed={settings.pressureSensitivity === on}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none relative group ${
                    settings.pressureSensitivity === on
                      ? isDark
                        ? "bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]/50"
                        : "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40"
                      : isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-black/10"
                  }`}
                >
                  <Tooltip label={on ? "Dynamic" : "Uniform"} />
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    opacity={settings.pressureSensitivity === on ? 1 : 0.5}
                  >
                    {on ? (
                      <path
                        d="M 2,8.5 C 4,7 7,4.5 14,8 C 7,11.5 4,10 2,8.5 Z"
                        fill={
                          settings.pressureSensitivity
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                      />
                    ) : (
                      <path
                        d="M 2,11 C 6,9 10,8 14,6"
                        stroke={
                          !settings.pressureSensitivity
                            ? isDark
                              ? "#93c5fd"
                              : "#3b82f6"
                            : isDark
                              ? "white"
                              : "black"
                        }
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    )}
                  </svg>
                </button>
              ))}
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  P
                </span>
              )}
              <div className="flex-1" />
              <div
                className={`w-px h-4 mx-0.5 ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              {(["off", "dot", "square"] as GridType[]).map((g) => {
                const active = settings.gridType === g;
                const iconColor = active
                  ? isDark
                    ? "#93c5fd"
                    : "#3b82f6"
                  : isDark
                    ? "rgba(255,255,255,0.5)"
                    : "rgba(0,0,0,0.4)";
                return (
                  <button
                    key={g}
                    onClick={() => updateSettings({ gridType: g })}
                    aria-pressed={active}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none relative group ${
                      active
                        ? isDark
                          ? "bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]/50"
                          : "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40"
                        : isDark
                          ? "hover:bg-white/10"
                          : "hover:bg-black/10"
                    }`}
                  >
                    <Tooltip label={g.charAt(0).toUpperCase() + g.slice(1)} />
                    {g === "off" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <line
                          x1="4"
                          y1="4"
                          x2="12"
                          y2="12"
                          stroke={iconColor}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="12"
                          y1="4"
                          x2="4"
                          y2="12"
                          stroke={iconColor}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    {g === "dot" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill={iconColor}
                      >
                        <circle cx="4" cy="4" r="1.2" />
                        <circle cx="8" cy="4" r="1.2" />
                        <circle cx="12" cy="4" r="1.2" />
                        <circle cx="4" cy="8" r="1.2" />
                        <circle cx="8" cy="8" r="1.2" />
                        <circle cx="12" cy="8" r="1.2" />
                        <circle cx="4" cy="12" r="1.2" />
                        <circle cx="8" cy="12" r="1.2" />
                        <circle cx="12" cy="12" r="1.2" />
                      </svg>
                    )}
                    {g === "square" && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke={iconColor}
                        strokeWidth="0.9"
                      >
                        <line x1="1" y1="5.5" x2="15" y2="5.5" />
                        <line x1="1" y1="10.5" x2="15" y2="10.5" />
                        <line x1="5.5" y1="1" x2="5.5" y2="15" />
                        <line x1="10.5" y1="1" x2="10.5" y2="15" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="flex items-baseline gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  Canvas
                </span>
                {settings.showTips && (
                  <span
                    className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                  >
                    1–9
                  </span>
                )}
              </span>
              <button
                onClick={() => setShowReorder(true)}
                className={`relative group w-5 h-5 flex items-center justify-center rounded transition-colors ${isDark ? "text-white/30 hover:text-white/65 hover:bg-white/10" : "text-black/25 hover:text-black/55 hover:bg-black/[0.07]"}`}
              >
                <Tooltip label="Manage canvases" />
                <svg width="12" height="11" viewBox="0 0 12 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <line x1="4.5" y1="1.5" x2="11" y2="1.5" />
                  <line x1="4.5" y1="5.5" x2="11" y2="5.5" />
                  <line x1="4.5" y1="9.5" x2="11" y2="9.5" />
                  <circle cx="1.5" cy="1.5" r="1" fill="currentColor" stroke="none" />
                  <circle cx="1.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
                  <circle cx="1.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1 mt-1 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const locked = n > canvasLimit;
                return (
                  <button
                    key={n}
                    onClick={() => onSwitchCanvas(n)}
                    aria-label={`Canvas ${n}`}
                    aria-pressed={activeCanvas === n}
                    className={`relative w-8 h-8 flex items-center justify-center rounded text-sm tabular-nums transition-colors focus:outline-none ${
                      locked
                        ? activeCanvas === n
                          ? isDark
                            ? "bg-white/5 text-white/25 ring-1 ring-white/10"
                            : "bg-black/5 text-black/20 ring-1 ring-black/10"
                          : isDark
                            ? "text-white/20 hover:text-white/30 hover:bg-white/5"
                            : "text-black/15 hover:text-black/25 hover:bg-black/5"
                        : activeCanvas === n
                          ? isDark
                            ? "bg-[#3b82f6]/20 text-[#93c5fd] ring-1 ring-[#3b82f6]/50"
                            : "bg-[#3b82f6]/12 text-[#3b82f6] ring-1 ring-[#3b82f6]/40"
                          : isDark
                            ? "text-white/40 hover:text-white/60 hover:bg-white/10"
                            : "text-black/35 hover:text-black/55 hover:bg-black/10"
                    }`}
                  >
                    {locked && <Tooltip label="Unlock with Unleashed" />}
                    {n}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                if (clearConfirming) {
                  if (clearConfirmTimerRef.current) {
                    clearTimeout(clearConfirmTimerRef.current);
                    clearConfirmTimerRef.current = null;
                  }
                  setClearConfirming(false);
                  setClearWipe((n) => n + 1);
                  window.dispatchEvent(new Event("drawtool:clear"));
                } else {
                  const detail = { count: 0 };
                  window.dispatchEvent(
                    new CustomEvent("drawtool:query-stroke-count", { detail }),
                  );
                  const needsConfirm =
                    settings.confirmClear &&
                    detail.count > CONFIRM_CLEAR_STROKE_THRESHOLD;
                  if (needsConfirm) {
                    setClearConfirming(true);
                    clearConfirmTimerRef.current = setTimeout(() => {
                      setClearConfirming(false);
                      clearConfirmTimerRef.current = null;
                    }, 3000);
                  } else {
                    setClearWipe((n) => n + 1);
                    window.dispatchEvent(new Event("drawtool:clear"));
                  }
                }
              }}
              className={`mt-4 w-full py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 relative overflow-hidden ${
                clearConfirming
                  ? isDark
                    ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    : "text-red-600 bg-red-500/8 hover:bg-red-500/15"
                  : isDark
                    ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10"
                    : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"
              }`}
            >
              {clearWipe > 0 && (
                <span
                  key={clearWipe}
                  className={`absolute inset-0 animate-wipe rounded ${isDark ? "bg-white/15" : "bg-black/10"}`}
                />
              )}
              <svg
                className="relative"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="2" y1="4.5" x2="14" y2="4.5" />
                <path d="M5.5 4.5V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1.5" />
                <path d="M3.5 4.5L4.2 13a.5.5 0 0 0 .5.5h6.6a.5.5 0 0 0 .5-.5l.7-8.5" />
                <line x1="6.5" y1="7.5" x2="6.5" y2="11" />
                <line x1="9.5" y1="7.5" x2="9.5" y2="11" />
              </svg>
              <span className="relative flex items-center gap-1.5">
                {clearConfirming ? "Are you sure?" : "Clear screen"}
                {settings.showTips && !clearConfirming && (
                  <span
                    className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/30 border-white/12 bg-white/5" : "text-black/30 border-black/10 bg-black/[0.04]"}`}
                  >
                    {mod} + X
                  </span>
                )}
              </span>
            </button>

            <div className="mt-5 flex items-baseline gap-2">
              <div
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Theme
              </div>
              {settings.showTips && (
                <span
                  className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/40 border-white/15 bg-white/5" : "text-black/40 border-black/12 bg-black/[0.04]"}`}
                >
                  D D
                </span>
              )}
            </div>
            <div className="grid grid-cols-8 gap-2 mt-1.5">
              {[
                {
                  id: "dark" as const,
                  label: "Black",
                  bg: "#06060e",
                  text: "#ffffff",
                },
                {
                  id: "midnight" as const,
                  label: "Midnight",
                  bg: "#15152a",
                  text: "#ffffff",
                },
                {
                  id: "lumber" as const,
                  label: "Lumber",
                  bg: "#141404",
                  text: "#e8d5c0",
                },
                {
                  id: "slate" as const,
                  label: "Slate",
                  bg: "#1c2128",
                  text: "#adbac7",
                },
                {
                  id: "journal" as const,
                  label: "Journal",
                  bg: "#fffce0",
                  text: "#000000",
                },
                {
                  id: "sand" as const,
                  label: "Sand",
                  bg: "#f5ede8",
                  text: "#4a3520",
                },
                {
                  id: "sky" as const,
                  label: "Sky",
                  bg: "#eaf4fb",
                  text: "#1a3a5c",
                },
                {
                  id: "white" as const,
                  label: "White",
                  bg: "#f5f5f0",
                  text: "#000000",
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  aria-label={`${t.label} theme`}
                  aria-pressed={settings.theme === t.id}
                  className={`h-7 rounded-md outline-none transition-[opacity,transform] duration-150 relative group ${
                    settings.theme === t.id
                      ? "opacity-100 scale-110"
                      : "opacity-45 hover:opacity-75"
                  }`}
                  style={{
                    backgroundColor: t.bg,
                    boxShadow: `inset 0 0 0 1px ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}`,
                  }}
                >
                  <Tooltip label={t.label} />
                </button>
              ))}
            </div>

            {hasTouch && (
              <button
                onClick={() => {
                  onResetView();
                  closeMenu();
                }}
                className={`mt-4 w-full py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
              >
                Reset zoom
              </button>
            )}

            <div className="mt-4 space-y-3">
              {!hasTouch && (
                <button
                  role="switch"
                  aria-checked={settings.showZoomControls}
                  onClick={() =>
                    updateSettings({
                      showZoomControls: !settings.showZoomControls,
                    })
                  }
                  className="flex items-center justify-between w-full text-sm cursor-pointer group"
                >
                  <span>Zoom controls</span>
                  <span
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      settings.showZoomControls
                        ? "bg-[#3b82f6]"
                        : isDark
                          ? "bg-white/15 group-hover:bg-white/25"
                          : "bg-black/12 group-hover:bg-black/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${
                        settings.showZoomControls
                          ? "translate-x-[16px] bg-white"
                          : isDark
                            ? "bg-white/70"
                            : "bg-white"
                      }`}
                    />
                  </span>
                </button>
              )}
              <button
                role="switch"
                aria-checked={settings.showSelectControls}
                onClick={() =>
                  updateSettings({
                    showSelectControls: !settings.showSelectControls,
                  })
                }
                className="flex items-center justify-between w-full text-sm cursor-pointer group"
              >
                <span>Selection controls</span>
                <span
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${settings.showSelectControls ? "bg-[#3b82f6]" : isDark ? "bg-white/15 group-hover:bg-white/25" : "bg-black/12 group-hover:bg-black/20"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${settings.showSelectControls ? "translate-x-[16px] bg-white" : isDark ? "bg-white/70" : "bg-white"}`}
                  />
                </span>
              </button>
              <button
                role="switch"
                aria-checked={settings.confirmClear}
                onClick={() =>
                  updateSettings({ confirmClear: !settings.confirmClear })
                }
                className="flex items-center justify-between w-full text-sm cursor-pointer group"
              >
                <span>Confirm clear</span>
                <span
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    settings.confirmClear
                      ? "bg-[#3b82f6]"
                      : isDark
                        ? "bg-white/15 group-hover:bg-white/25"
                        : "bg-black/12 group-hover:bg-black/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${
                      settings.confirmClear
                        ? "translate-x-[16px] bg-white"
                        : isDark
                          ? "bg-white/70"
                          : "bg-white"
                    }`}
                  />
                </span>
              </button>
              <button
                role="switch"
                aria-checked={settings.showTips}
                onClick={() =>
                  updateSettings({ showTips: !settings.showTips })
                }
                className="flex items-center justify-between w-full text-sm cursor-pointer group"
              >
                <span>Show tips</span>
                <span
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    settings.showTips
                      ? "bg-[#3b82f6]"
                      : isDark
                        ? "bg-white/15 group-hover:bg-white/25"
                        : "bg-black/12 group-hover:bg-black/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${
                      settings.showTips
                        ? "translate-x-[16px] bg-white"
                        : isDark
                          ? "bg-white/70"
                          : "bg-white"
                    }`}
                  />
                </span>
              </button>
              {!hasTouch && (
                <div className="flex items-center justify-between w-full text-sm">
                  <span>Mouse buttons</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] ${isDark ? "text-white/35" : "text-black/35"}`}
                    >
                      L
                    </span>
                    <ClickToolPicker
                      value={settings.leftClickTool}
                      onChange={(v) => updateSettings({ leftClickTool: v })}
                      isDark={isDark}
                    />
                    <span
                      className={`text-[10px] ml-0.5 ${isDark ? "text-white/35" : "text-black/35"}`}
                    >
                      R
                    </span>
                    <ClickToolPicker
                      value={settings.rightClickTool}
                      onChange={(v) => updateSettings({ rightClickTool: v })}
                      isDark={isDark}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              {!hasTouch && (
                <button
                  onClick={() => {
                    onToggleFullscreen();
                    closeMenu();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? "bg-white/5 text-white/55 hover:bg-white/[0.11] hover:text-white/85" : "bg-black/[0.04] text-black/50 hover:bg-black/[0.09] hover:text-black/75"}`}
                >
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
                    <path d="M2 6V2h4" />
                    <path d="M10 2h4v4" />
                    <path d="M14 10v4h-4" />
                    <path d="M6 14H2v-4" />
                  </svg>
                  Fullscreen
                  {settings.showTips && (
                    <span className={`ml-auto text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/30 border-white/12 bg-white/5" : "text-black/30 border-black/10 bg-black/[0.04]"}`}>
                      {mod} + F
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  window.dispatchEvent(new Event("drawtool:toggle-stash"));
                  closeMenu();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? "bg-white/5 text-white/55 hover:bg-white/[0.11] hover:text-white/85" : "bg-black/[0.04] text-black/50 hover:bg-black/[0.09] hover:text-black/75"}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1.75" y="4.5" width="10.5" height="8" rx="0.75" />
                  <line x1="1.75" y1="8" x2="12.25" y2="8" />
                  <line x1="7" y1="4.5" x2="7" y2="12.5" />
                  <rect x="1" y="2.75" width="12" height="2.5" rx="0.75" />
                </svg>
                <span className="flex flex-col items-start gap-0.5">
                  Stash
                  {settings.showTips && (
                    <span className={`text-[9px] font-normal leading-tight ${isDark ? "text-white/25" : "text-black/25"}`}>
                      Save &amp; reuse content across canvases
                    </span>
                  )}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {settings.showTips && (
                    <span className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/30 border-white/12 bg-white/5" : "text-black/30 border-black/10 bg-black/[0.04]"}`}>
                      ⇧ + B
                    </span>
                  )}
                  {stashCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${isDark ? "bg-white/10 text-white/40" : "bg-black/[0.07] text-black/40"}`}
                    >
                      {stashCount}
                    </span>
                  )}
                </span>
              </button>
              {!hasTouch && (
                <button
                  onClick={() => {
                    closeMenu();
                    setShowKeysModal(true);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? "bg-white/5 text-white/55 hover:bg-white/[0.11] hover:text-white/85" : "bg-black/[0.04] text-black/50 hover:bg-black/[0.09] hover:text-black/75"}`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="1" y="4" width="12" height="7" rx="1.5" />
                    <line
                      x1="3.5"
                      y1="6.8"
                      x2="3.5"
                      y2="6.8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="7"
                      y1="6.8"
                      x2="7"
                      y2="6.8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="10.5"
                      y1="6.8"
                      x2="10.5"
                      y2="6.8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line x1="4.5" y1="9" x2="9.5" y2="9" />
                  </svg>
                  Keys
                  {settings.showTips && (
                    <span className={`ml-auto text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/30 border-white/12 bg-white/5" : "text-black/30 border-black/10 bg-black/[0.04]"}`}>
                      ?
                    </span>
                  )}
                </button>
              )}

              <AccordionSection
                label="Export"
                dim={!onExport}
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 10V3" />
                    <path d="M4.5 5 7 2l2.5 3" />
                    <line x1="2" y1="12.5" x2="12" y2="12.5" />
                  </svg>
                }
                open={showExport}
                onToggle={() =>
                  setShowExport((v) => {
                    if (!v)
                      setTimeout(
                        () =>
                          exportContentRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          }),
                        0,
                      );
                    return !v;
                  })
                }
                isDark={isDark}
                tip={settings.showTips ? (
                  <span className={`text-[9px] font-mono px-1 py-px rounded border ${isDark ? "text-white/30 border-white/12 bg-white/5" : "text-black/30 border-black/10 bg-black/[0.04]"}`}>
                    {mod} + E
                  </span>
                ) : undefined}
              >
                <div ref={exportContentRef} className="space-y-3">
                  {/* Format + transparent + export on one row */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {/* Format pills */}
                    <div
                      className={`flex rounded overflow-hidden border ${isDark ? "border-white/10" : "border-black/10"}`}
                    >
                      {(["PNG", "SVG"] as const).map((fmt) => {
                        const active = exportFormat === fmt.toLowerCase();
                        const locked = fmt === "SVG" && !isPro;
                        return (
                          <button
                            key={fmt}
                            onClick={() => !locked && onSetExportFormat(fmt.toLowerCase() as "png" | "svg")}
                            title={locked ? "SVG export requires Unleashed" : undefined}
                            className={`px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none flex items-center gap-1 ${
                              locked
                                ? isDark ? "text-white/20 cursor-default" : "text-black/20 cursor-default"
                                : active
                                  ? isDark ? "bg-white/15 text-white" : "bg-black/10 text-black"
                                  : isDark ? "text-white/40 hover:text-white/70" : "text-black/35 hover:text-black/60"
                            }`}
                          >
                            {fmt}
                            {locked && <span className="text-[9px] opacity-60">Pro</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Transparent toggle */}
                    <button
                      onClick={() =>
                        onSetExportTransparentBg(!exportTransparentBg)
                      }
                      title="Transparent background"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors focus:outline-none border ${
                        exportTransparentBg
                          ? isDark
                            ? "bg-white/15 text-white border-white/20"
                            : "bg-black/10 text-black border-black/15"
                          : isDark
                            ? "text-white/40 border-white/10 hover:text-white/70"
                            : "text-black/35 border-black/10 hover:text-black/60"
                      }`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="1" y="2" width="12" height="10" rx="1.5" />
                        <rect
                          x="1"
                          y="2"
                          width="6"
                          height="5"
                          rx="1.5"
                          fill="currentColor"
                          fillOpacity="0.2"
                          stroke="none"
                        />
                        <rect
                          x="7"
                          y="7"
                          width="6"
                          height="5"
                          rx="1.5"
                          fill="currentColor"
                          fillOpacity="0.2"
                          stroke="none"
                        />
                        <line
                          x1="1"
                          y1="7"
                          x2="13"
                          y2="7"
                          strokeOpacity="0.3"
                        />
                        <line
                          x1="7"
                          y1="2"
                          x2="7"
                          y2="12"
                          strokeOpacity="0.3"
                        />
                      </svg>
                      <span>Transparent</span>
                    </button>
                    {/* Export button */}
                    <button
                      onClick={() =>
                        onExport?.(exportFormat, exportTransparentBg)
                      }
                      disabled={!onExport}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors focus:outline-none bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 2v8" />
                        <path d="M4.5 8 7 11l2.5-3" />
                        <line x1="2" y1="13" x2="12" y2="13" />
                      </svg>
                      Export
                    </button>
                  </div>
                  {/* Export selection row */}
                  {selectionCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] ${isDark ? "text-white/40" : "text-black/35"}`}
                      >
                        {selectionCount} selected
                      </span>
                      <button
                        onClick={() => onExportSelection(exportTransparentBg)}
                        className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors focus:outline-none border ${isDark ? "border-white/15 text-white/80 hover:text-white hover:border-white/30" : "border-black/15 text-black/60 hover:text-black hover:border-black/30"}`}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M7 2v8" />
                          <path d="M4.5 8 7 11l2.5-3" />
                          <line x1="2" y1="13" x2="12" y2="13" />
                        </svg>
                        Export selection
                      </button>
                    </div>
                  )}
                  {/* Export / Import rows */}
                  <div className="space-y-1.5">
                    {/* Include images toggle */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => onSetExportIncludeImages(!exportIncludeImages)}
                        title="Embed images in exported JSON"
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors focus:outline-none border ${
                          exportIncludeImages
                            ? isDark
                              ? "bg-white/15 text-white border-white/20"
                              : "bg-black/10 text-black border-black/15"
                            : isDark
                              ? "text-white/40 border-white/10 hover:text-white/70"
                              : "text-black/35 border-black/10 hover:text-black/60"
                        }`}
                      >
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="2" width="12" height="10" rx="1.5" />
                          <circle cx="4.5" cy="5.5" r="1.2" />
                          <path d="M1 10l3-3 2.5 2.5L9 7l4 4" />
                        </svg>
                        <span>Include images</span>
                      </button>
                    </div>
                    {(
                      [
                        { label: "Canvas", onExport: onExportData, onImport: onImportData },
                        { label: "Workspace", onExport: onExportWorkspace, onImport: onImportWorkspace },
                      ] as const
                    ).map(({ label, onExport, onImport }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`text-[11px] w-16 shrink-0 ${isDark ? "text-white/40" : "text-black/35"}`}>
                          {label}
                        </span>
                        <div className="flex flex-1 gap-1">
                          {(
                            [
                              { action: "Export", onClick: onExport, isExport: true },
                              { action: "Import", onClick: onImport, isExport: false },
                            ] as const
                          ).map(({ action, onClick, isExport }) => {
                            const disabledImport = !isExport && label === "Canvas" && activeCanvas > canvasLimit;
                            return (
                            <button
                              key={action}
                              onClick={disabledImport ? undefined : onClick}
                              disabled={disabledImport}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[11px] transition-colors focus:outline-none border ${disabledImport ? isDark ? "border-white/5 text-white/15 cursor-not-allowed" : "border-black/5 text-black/15 cursor-not-allowed" : isDark ? "border-white/10 text-white/55 hover:text-white hover:border-white/25" : "border-black/10 text-black/50 hover:text-black hover:border-black/25"}`}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 14 14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                {isExport ? (
                                  <>
                                    <path d="M7 10V3" />
                                    <path d="M4.5 5 7 2l2.5 3" />
                                    <line x1="2" y1="13" x2="12" y2="13" />
                                  </>
                                ) : (
                                  <>
                                    <path d="M7 2v8" />
                                    <path d="M4.5 8 7 11l2.5-3" />
                                    <line x1="2" y1="13" x2="12" y2="13" />
                                  </>
                                )}
                              </svg>
                              {action}
                            </button>
                          );})}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasTouch && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className={`text-[11px] w-16 shrink-0 ${isDark ? "text-white/40" : "text-black/35"}`}>Image</span>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new Event("drawtool:open-image-insert"));
                          closeMenu();
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[11px] transition-colors focus:outline-none border ${isDark ? "border-white/10 text-white/55 hover:text-white hover:border-white/25" : "border-black/10 text-black/50 hover:text-black hover:border-black/25"}`}
                      >
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="2" width="12" height="10" rx="1.5" />
                          <circle cx="4.5" cy="5.5" r="1.2" />
                          <path d="M1 10l3-3 2.5 2.5L9 7l4 4" />
                        </svg>
                        Insert from photos
                      </button>
                    </div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                label="Help"
                dim
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="7" cy="7" r="5.5" />
                    <path d="M5.5 5.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" />
                    <circle
                      cx="7"
                      cy="10"
                      r="0.6"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                }
                open={showHelp}
                onToggle={() =>
                  setShowHelp((v) => {
                    if (!v)
                      setTimeout(
                        () =>
                          helpRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          }),
                        0,
                      );
                    return !v;
                  })
                }
                isDark={isDark}
              >
                <div
                  ref={helpRef}
                  className={`text-xs space-y-4 pt-2.5 ${isDark ? "text-white/60" : "text-black/60"}`}
                >
                  {!hasTouch && (
                    <div>
                      <div
                        className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Getting started
                      </div>
                      <div className="space-y-1">
                        {[
                          ["Draw", `${mod} + drag`],
                          ["Draw freehand", "click + drag"],
                          ["Dashed line", "⇧ + drag"],
                          ["Straight line", `${mod} + ⇧ + drag`],
                          ["Draw shape", "S + drag"],
                          ["Erase", `${alt} + drag`],
                          ["Write text", "T, then click"],
                        ].map(([label, kbd]) => (
                          <div
                            key={label}
                            className="flex justify-between gap-4"
                          >
                            <span>{label}</span>
                            <kbd
                              className={`shrink-0 ${isDark ? "text-white/35" : "text-black/35"}`}
                            >
                              {kbd}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div
                      className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${isDark ? "text-white/30" : "text-black/30"}`}
                    >
                      Tips
                    </div>
                    <ul className="space-y-1.5 list-none">
                      {(
                        [
                          !hasTouch && (
                            <>
                              Press{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                V
                              </kbd>{" "}
                              to select — drag to move, or{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                Ctrl
                              </kbd>{" "}
                              + drag to box-select multiple strokes.
                            </>
                          ),
                          "Tap a line or arrow to select it — drag any point to bend it. While drawing, tap to add a bend mid-stroke.",
                          "Double-tap text to edit it.",
                          hasTouch && "Long-press any tool button to see more options.",
                          hasTouch && "Two-finger tap to undo, three-finger tap to redo.",
                          hasTouch && "Swipe the toolbar left or right to switch canvases.",
                          !hasTouch && (
                            <>
                              Hold{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                F
                              </kbd>{" "}
                              while drawing a shape to fill it.{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                {alt}
                              </kbd>{" "}
                              +{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                F
                              </kbd>{" "}
                              cycles fill styles.
                            </>
                          ),
                          !hasTouch && (
                            <>
                              Press{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                [{" "}
                              </kbd>{" "}
                              or{" "}
                              <kbd
                                className={
                                  isDark ? "text-white/35" : "text-black/35"
                                }
                              >
                                {" "}
                                ]
                              </kbd>{" "}
                              to cycle through colours.
                            </>
                          ),
                          !hasTouch &&
                            "Press 1–9 to jump between 9 canvases. Press 0 for the emptiest one.",
                        ] as React.ReactNode[]
                      )
                        .filter(Boolean)
                        .map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                    </ul>
                  </div>

                  <div>
                    <div
                      className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${isDark ? "text-white/30" : "text-black/30"}`}
                    >
                      URL tricks
                    </div>
                    <ul className="space-y-1.5 list-none">
                      {[
                        [
                          "/new",
                          "Opens a blank canvas — silently switches to the first empty slot, or asks before clearing if all 9 are in use.",
                        ],
                      ].map(([path, desc]) => (
                        <li key={path}>
                          <code
                            className={`text-[11px] mr-1.5 ${isDark ? "text-white/50" : "text-black/50"}`}
                          >
                            {path}
                          </code>
                          {desc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                label="About"
                dim
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="7" cy="7" r="5.5" />
                    <line
                      x1="7"
                      y1="6.5"
                      x2="7"
                      y2="10"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="7"
                      cy="4.5"
                      r="0.6"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                }
                open={showAbout}
                onToggle={() =>
                  setShowAbout((v) => {
                    if (!v)
                      setTimeout(
                        () =>
                          aboutRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          }),
                        0,
                      );
                    return !v;
                  })
                }
                isDark={isDark}
              >
                <div
                  ref={aboutRef}
                  className={`text-xs leading-relaxed break-words ${isDark ? "text-white/60" : "text-black/60"}`}
                >
                  <p>
                    drawzilla started as a personal tool &mdash; a drawing
                    canvas that stays out of the way.
                  </p>
                  <ul className="mt-1.5 list-disc list-inside space-y-1">
                    <li>Freehand and clean, no sidebar bloat.</li>
                    <li>
                      Every tool a key away &mdash; so you never have to leave
                      the canvas to reach a toolbar.
                    </li>
                    <li>Built for trackpads, great with a mouse.</li>
                  </ul>
                </div>
              </AccordionSection>
            </div>

            {(onShareCanvas || onShareWorkspace) && (() => {
              const hasLiveCanvas = canvasShares?.some(s => s.type === 'live') ?? false
              const clipboardIcon = <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="1" width="9" height="11" rx="1.5" /><path d="M2 4.5V14a1 1 0 0 0 1 1h8" /></svg>
              const checkIcon = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6.5 4.5,9.5 10.5,2.5" /></svg>
              const xIcon = <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" /></svg>
              const labelCls = `shrink-0 text-[11px] font-medium w-[62px] ${isDark ? "text-white/35" : "text-black/35"}`
              const inputCls = `flex-1 min-w-0 text-[11px] px-2 py-1 rounded truncate ${isDark ? "bg-white/6 text-white/50" : "bg-black/4 text-black/50"}`
              const iconBtnCls = (active: boolean) => `shrink-0 p-1 rounded transition-colors group relative ${active ? isDark ? "text-green-400" : "text-green-600" : isDark ? "hover:bg-white/10 text-white/35 hover:text-white/65" : "hover:bg-black/8 text-black/30 hover:text-black/60"}`
              const tipCls = `absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white z-50`
              return (
                <div className="mt-2 flex flex-col gap-1.5">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-1 py-0.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={isDark ? "text-white/40" : "text-black/40"}>
                      <circle cx="13" cy="3" r="2" /><circle cx="3" cy="8" r="2" /><circle cx="13" cy="13" r="2" />
                      <line x1="5" y1="7" x2="11" y2="4" /><line x1="5" y1="9" x2="11" y2="12" />
                    </svg>
                    <span className={`text-xs font-medium ${isDark ? "text-white/50" : "text-black/50"}`}>Share</span>
                  </div>

                  {/* Canvas rows */}
                  {canvasShares?.map(share => {
                    const url = `${window.location.origin}/s/${share.token}`
                    const urgency = share.expires_at ? expiryUrgency(share.expires_at) : 'ok'
                    const expiryBadge = urgency === 'urgent'
                      ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-500/15 text-red-600'
                      : urgency === 'warn'
                        ? isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-500/15 text-orange-600'
                        : isDark ? 'bg-yellow-500/15 text-yellow-400/80' : 'bg-yellow-500/12 text-yellow-700'
                    return (
                      <div key={share.token} className="flex items-center gap-1">
                        <span className={labelCls}>Canvas</span>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${share.type === 'live' ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-500/12 text-green-700' : isDark ? 'bg-white/8 text-white/40' : 'bg-black/6 text-black/40'}`}>
                          {share.type === 'live' ? 'Live' : 'Snap'}
                        </span>
                        {share.expires_at && <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${expiryBadge}`}>{formatExpiry(share.expires_at)}</span>}
                        <input readOnly value={url} className={inputCls} />
                        <button
                          onClick={() => { navigator.clipboard.writeText(url); setCopiedShareToken(share.token); if (copiedShareTimerRef.current) clearTimeout(copiedShareTimerRef.current); copiedShareTimerRef.current = setTimeout(() => setCopiedShareToken(null), 1500); }}
                          className={iconBtnCls(copiedShareToken === share.token)}
                        >
                          <span className={tipCls}>Copy</span>
                          {copiedShareToken === share.token ? checkIcon : clipboardIcon}
                        </button>
                        {onDeleteShare && (
                          <button title="" onClick={() => onDeleteShare(share.token)} className={iconBtnCls(false)}>
                            <span className={tipCls}>Unshare</span>
                            {xIcon}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {/* Canvas + Workspace idle buttons — shown side by side when neither is active */}
                  {onShareCanvas && !hasLiveCanvas && onShareWorkspace && !shareWorkspaceUrl ? (
                    <div className="flex gap-1.5">
                      <button
                        disabled={sharing === 'canvas'}
                        onClick={async () => { setSharing('canvas'); const result = await onShareCanvas(); if (result) navigator.clipboard.writeText(result.url); setSharing(null); }}
                        className={`flex-1 text-[11px] px-2 py-1 rounded font-medium transition-colors ${isDark ? "bg-white/8 hover:bg-white/14 text-white/55 hover:text-white/80" : "bg-black/6 hover:bg-black/10 text-black/50 hover:text-black/70"}`}
                      >
                        {sharing === 'canvas' ? '…' : canvasShares?.length ? '+ Canvas link' : 'Canvas'}
                      </button>
                      <button
                        disabled={sharing === 'workspace'}
                        onClick={async () => { setSharing('workspace'); const url = await onShareWorkspace(); if (url) { setShareWorkspaceUrl(url); navigator.clipboard.writeText(url); } setSharing(null); }}
                        className={`flex-1 text-[11px] px-2 py-1 rounded font-medium transition-colors ${isDark ? "bg-white/8 hover:bg-white/14 text-white/55 hover:text-white/80" : "bg-black/6 hover:bg-black/10 text-black/50 hover:text-black/70"}`}
                      >
                        {sharing === 'workspace' ? '…' : 'Workspace'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Canvas create button — only when canvas not yet live */}
                      {onShareCanvas && !hasLiveCanvas && (
                        <div className="flex items-center gap-1">
                          <span className={labelCls}>Canvas</span>
                          <button
                            disabled={sharing === 'canvas'}
                            onClick={async () => { setSharing('canvas'); const result = await onShareCanvas(); if (result) navigator.clipboard.writeText(result.url); setSharing(null); }}
                            className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${isDark ? "bg-white/8 hover:bg-white/14 text-white/55 hover:text-white/80" : "bg-black/6 hover:bg-black/10 text-black/50 hover:text-black/70"}`}
                          >
                            {sharing === 'canvas' ? '…' : canvasShares?.length ? '+ New link' : 'Share'}
                          </button>
                        </div>
                      )}

                      {/* Workspace row — Pro only */}
                      {onShareWorkspace && (
                        <div className="flex items-center gap-1">
                          <span className={labelCls}>Workspace</span>
                          {shareWorkspaceUrl ? (<>
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-500/12 text-green-700'}`}>Live</span>
                            <input readOnly value={shareWorkspaceUrl} className={inputCls} />
                            <button
                              onClick={() => { navigator.clipboard.writeText(shareWorkspaceUrl); setCopiedShareToken('workspace'); if (copiedShareTimerRef.current) clearTimeout(copiedShareTimerRef.current); copiedShareTimerRef.current = setTimeout(() => setCopiedShareToken(null), 1500); }}
                              className={iconBtnCls(copiedShareToken === 'workspace')}
                            >
                              <span className={tipCls}>Copy</span>
                              {copiedShareToken === 'workspace' ? checkIcon : clipboardIcon}
                            </button>
                            {onUnshareWorkspace && (
                              <button title="" onClick={async () => { await onUnshareWorkspace(); setShareWorkspaceUrl(null); }} className={iconBtnCls(false)}>
                                <span className={tipCls}>Unshare</span>
                                {xIcon}
                              </button>
                            )}
                          </>) : (
                            <button
                              disabled={sharing === 'workspace'}
                              onClick={async () => { setSharing('workspace'); const url = await onShareWorkspace(); if (url) { setShareWorkspaceUrl(url); navigator.clipboard.writeText(url); } setSharing(null); }}
                              className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${isDark ? "bg-white/8 hover:bg-white/14 text-white/55 hover:text-white/80" : "bg-black/6 hover:bg-black/10 text-black/50 hover:text-black/70"}`}
                            >
                              {sharing === 'workspace' ? '…' : 'Share'}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}

            <div className="mt-4 space-y-1.5">
              <button
                onClick={() => {
                  onStartTraining();
                  closeMenu();
                }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isDark ? "bg-white/5 hover:bg-white/9" : "bg-black/4 hover:bg-black/7"}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                >
                  {/* board */}
                  <path
                    d="M8 2.5 L14.5 5.5 L8 8.5 L1.5 5.5 Z"
                    stroke="#3b82f6"
                  />
                  {/* cap body */}
                  <path
                    d="M4.5 7.5 L4.5 11.5 Q4.5 13.5 8 13.5 Q11.5 13.5 11.5 11.5 L11.5 7.5"
                    stroke="#ec4899"
                  />
                  {/* tassel cord + bob */}
                  <line
                    x1="14.5"
                    y1="5.5"
                    x2="14.5"
                    y2="9.5"
                    stroke="#ec4899"
                  />
                  <circle cx="14.5" cy="10.2" r="0.9" fill="#ec4899" />
                </svg>
                <div>
                  <div
                    className={`text-xs font-medium leading-snug ${isDark ? "text-white/80" : "text-black/75"}`}
                  >
                    Training
                  </div>
                  <div
                    className={`text-[11px] leading-snug mt-0.5 ${isDark ? "text-white/40" : "text-black/40"}`}
                  >
                    Learn the shortcuts and how to use drawzilla
                  </div>
                </div>
              </button>
              <a
                href="https://writing.drawzil.la"
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isDark ? "bg-white/5 hover:bg-white/9" : "bg-black/4 hover:bg-black/7"}`}
              >
                <img
                  src="/writing-icon.png"
                  alt=""
                  width="16"
                  height="16"
                  className="mt-0.5 shrink-0 rounded-[3px]"
                />
                <div>
                  <div
                    className={`text-xs font-medium leading-snug flex items-center gap-1.5 ${isDark ? "text-white/80" : "text-black/75"}`}
                  >
                    writing by drawzilla
                  </div>
                  <div
                    className={`text-[11px] leading-snug mt-0.5 ${isDark ? "text-white/40" : "text-black/40"}`}
                  >
                    Improve your freehand drawing on canvas
                  </div>
                </div>
              </a>
            </div>

            {subscription?.status === 'cancelling' && subscription.cancelAt && (
              <div className={`mt-2 pt-2 border-t ${isDark ? "border-white/10" : "border-black/8"}`}>
                <div className={`rounded-lg px-3 py-2.5 text-xs ${isDark ? "bg-amber-900/40 text-amber-200/80" : "bg-amber-50 text-amber-800"}`}>
                  <div className="mb-2">
                    Subscription ends {new Date(subscription.cancelAt * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. Resubscribe to carry on where you left off, or export your data before it's gone.
                  </div>
                  <div className="flex gap-2">
                    {onExportWorkspacesZip && (
                      <button
                        onClick={onExportWorkspacesZip}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${isDark ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200" : "bg-amber-100 hover:bg-amber-200 text-amber-800"}`}
                      >
                        Export data
                      </button>
                    )}
                    {onResubscribe && (
                      <button
                        onClick={onResubscribe}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${isDark ? "bg-white/10 hover:bg-white/15 text-white/70" : "bg-white/60 hover:bg-white/80 text-black/60"}`}
                      >
                        Resubscribe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className={`w-full text-xs px-3 py-2 rounded-lg font-medium transition-colors ${isDark ? "bg-white/8 hover:bg-white/12 text-white/70 hover:text-white/90" : "bg-black/5 hover:bg-black/9 text-black/60 hover:text-black/80"}`}>
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2 px-1 py-1">
                  <UserButton afterSignOutUrl="/" />
                  <span className={`text-xs flex-1 ${isDark ? "text-white/50" : "text-black/50"}`}>{user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Account" : "Account"}</span>
                  <button
                    onClick={() => signOut({ redirectUrl: "/" })}
                    className={`text-xs transition-colors ${isDark ? "text-white/30 hover:text-white/60" : "text-black/30 hover:text-black/60"}`}
                  >
                    Sign out
                  </button>
                </div>
              </SignedIn>
            </div>

            <div className={`mt-2 pt-2 text-center`}>
              <a
                href="https://liamo.co"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs transition-colors ${isDark ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70"}`}
              >
                liamo.co
              </a>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
