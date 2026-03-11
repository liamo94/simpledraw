import React, { useState, useRef, useEffect } from "react";
import type {
  Settings,
  Theme,
  TextSize,
  GridType,
  FontFamily,
  TextAlign,
  FillStyle,
} from "../hooks/useSettings";
import ShortcutsPanel from "./ShortcutsPanel";

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

function AccordionSection({
  label,
  icon,
  open,
  onToggle,
  isDark,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          isDark
            ? `${open ? "bg-white/[0.08] text-white/80" : "bg-white/5 text-white/55"} hover:bg-white/[0.11] hover:text-white/85`
            : `${open ? "bg-black/[0.07] text-black/70" : "bg-black/[0.04] text-black/50"} hover:bg-black/[0.09] hover:text-black/75`
        }`}
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
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
      </button>
      {open && <div className="mt-1.5 px-1 pb-1">{children}</div>}
    </div>
  );
}

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  onExport: (format: "png" | "svg", transparent: boolean) => void;
  exportFormat: "png" | "svg";
  exportTransparentBg: boolean;
  onSetExportFormat: (f: "png" | "svg") => void;
  onSetExportTransparentBg: (v: boolean) => void;
  hasTouch: boolean;
  activeCanvas: number;
  onSwitchCanvas: (n: number) => void;
  onToggleFullscreen: () => void;
  onResetView: () => void;
  onExportData: () => void;
  onImportData: () => void;
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
  onToggleFullscreen,
  onResetView,
  onExportData,
  onImportData,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [clearWipe, setClearWipe] = useState(0);
  const [clearConfirming, setClearConfirming] = useState(false);
  const clearConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const isMac = /mac/i.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";

  const isDark = isDarkTheme(settings.theme);

  useEffect(() => {
    const onToggle = () =>
      setOpen((o) => {
        if (o) {
          setShowInfo(false);
          setShowHelp(false);
          setShowAbout(false);
          setShowExport(false);
          setClearWipe(0);
        }
        return !o;
      });
    window.addEventListener("drawtool:toggle-menu", onToggle);
    return () => window.removeEventListener("drawtool:toggle-menu", onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setShowInfo(false);
        setShowHelp(false);
        setShowAbout(false);
        setShowExport(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setShowInfo(false);
    setShowHelp(false);
    setShowAbout(false);
    setShowExport(false);
    setClearWipe(0);
    setClearConfirming(false);
    if (clearConfirmTimerRef.current) {
      clearTimeout(clearConfirmTimerRef.current);
      clearConfirmTimerRef.current = null;
    }
  };

  const palette = [
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
  ];

  return (
    <>
      <div
        ref={menuRef}
        className="fixed top-4 right-4 z-50 flex flex-col items-end"
      >
        <button
          aria-label="Menu"
          aria-expanded={open}
          onClick={(e) => {
            setOpen((o) => {
              if (o) {
                setShowInfo(false);
                setShowAbout(false);
                setClearWipe(0);
              }
              return !o;
            });
            (e.currentTarget as HTMLElement).blur();
          }}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border backdrop-blur-sm transition-all duration-200 outline-none focus:outline-none ${open ? (isDark ? "bg-white/20 border-white/30 text-white" : "bg-black/20 border-black/30 text-black") : isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            {open ? (
              <>
                <line x1="3" y1="3" x2="11" y2="11" />
                <line x1="11" y1="3" x2="3" y2="11" />
              </>
            ) : (
              <>
                <line x1="3" y1="3.5" x2="11" y2="3.5" stroke="#3b82f6" />
                <line x1="3" y1="7" x2="11" y2="7" stroke="#ef4444" />
                <line x1="3" y1="10.5" x2="11" y2="10.5" stroke="#22c55e" />
              </>
            )}
          </svg>
        </button>

        {open && (
          <nav
            aria-label="Settings menu"
            className={`mt-2 p-4 rounded-xl border backdrop-blur-sm w-[min(340px,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden ${hasTouch ? "max-h-[calc(100dvh-8rem)]" : "max-h-[calc(100vh-8rem)]"} ${settings.theme === "midnight" ? "border-white/15" : isDark ? `${hasTouch ? "bg-black/90" : "bg-black/90"} border-white/15` : `${hasTouch ? "bg-white/90" : "bg-white/90"} border-black/15`}`}
            style={
              settings.theme === "midnight"
                ? {
                    background: hasTouch
                      ? "rgba(15,15,30,0.93)"
                      : "rgba(15,15,30,0.90)",
                  }
                : undefined
            }
          >
            <div
              className="text-xl mb-3 text-center select-none"
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
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Line thickness
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
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
              >
                Dash gap
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

            <div
              className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              Color
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
                  className="w-5 h-5 shrink-0 rounded-full border-2 transition-transform focus:outline-none"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      settings.lineColor === color
                        ? isDark
                          ? "white"
                          : "black"
                        : "transparent",
                    transform:
                      settings.lineColor === color ? "scale(1.2)" : undefined,
                  }}
                />
              ))}
            </div>

            {!hasTouch && (
              <>
                <div
                  className={`mt-4 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  Text size
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
                            ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                            : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                          : isDark
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div
                  className={`mt-3 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
                >
                  Font
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
                            ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                            : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
                          ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
                          ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
                          ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
                          ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
                          ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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

            <div
              className={`mt-3 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              Shape
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
                        ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                        : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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
                          ? "#5dd8e8"
                          : "#00618c"
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

            <div
              className={`mt-3 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              Fill
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
                          ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
                                ? "#5dd8e8"
                                : "#00618c"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
                                ? "#5dd8e8"
                                : "#00618c"
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
                                ? "#5dd8e8"
                                : "#00618c"
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
                                ? "#5dd8e8"
                                : "#00618c"
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
                                ? "#5dd8e8"
                                : "#00618c"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
                  style={{ accentColor: isDark ? "#5dd8e8" : "#00618c" }}
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
              <span>Grid</span>
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
                        ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                        : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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
                          ? "#5dd8e8"
                          : "#00618c"
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
                        ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                        : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
                              ? "#5dd8e8"
                              : "#00618c"
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
              <div className="flex-1" />
              <div
                className={`w-px h-4 mx-0.5 ${isDark ? "bg-white/15" : "bg-black/15"}`}
              />
              {(["off", "dot", "square"] as GridType[]).map((g) => {
                const active = settings.gridType === g;
                const iconColor = active
                  ? isDark
                    ? "#5dd8e8"
                    : "#00618c"
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
                          ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                          : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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

            <div
              className={`mt-3 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              Canvas
            </div>
            <div className="flex gap-1 mt-1 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => onSwitchCanvas(n)}
                  aria-label={`Canvas ${n}`}
                  aria-pressed={activeCanvas === n}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm tabular-nums transition-colors focus:outline-none ${
                    activeCanvas === n
                      ? isDark
                        ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50"
                        : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                      : isDark
                        ? "text-white/40 hover:text-white/60 hover:bg-white/10"
                        : "text-black/35 hover:text-black/55 hover:bg-black/10"
                  }`}
                >
                  {n}
                </button>
              ))}
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
                    settings.confirmClear && detail.count > 10;
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
              <span className="relative">
                {clearConfirming ? "Are you sure?" : "Clear screen"}
              </span>
            </button>

            <div
              className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}
            >
              Theme
            </div>
            <div className="flex gap-2 mt-1.5">
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
                  bg: "#1a1a2e",
                  text: "#ffffff",
                },
                {
                  id: "lumber" as const,
                  label: "Lumber",
                  bg: "#110e0a",
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
                  bg: "#f5e2b8",
                  text: "#000000",
                },
                {
                  id: "sky" as const,
                  label: "Sky",
                  bg: "#e0ecf6",
                  text: "#1a3a5c",
                },
                {
                  id: "sand" as const,
                  label: "Sand",
                  bg: "#f5e8dc",
                  text: "#4a3520",
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
                  className={`w-7 h-7 rounded-md outline-none transition-[opacity,transform] duration-150 relative group ${
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

            {!hasTouch && (
              <button
                onClick={() => {
                  onToggleFullscreen();
                  closeMenu();
                }}
                className={`mt-4 w-full py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
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
                        ? "bg-[#00618c]"
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
                      ? "bg-[#00618c]"
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
            </div>

            <div className="mt-4 space-y-1.5">
              {!hasTouch && (
                <AccordionSection
                  label="Keys"
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
                  }
                  open={showInfo}
                  onToggle={() =>
                    setShowInfo((v) => {
                      if (!v)
                        setTimeout(
                          () =>
                            infoRef.current?.scrollIntoView({
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
                  <div ref={infoRef}>
                    <ShortcutsPanel isDark={isDark} />
                  </div>
                </AccordionSection>
              )}

              <AccordionSection
                label="Help"
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
                          [
                            "Draw shape",
                            `${isMac ? "Ctrl" : `${alt} + ⇧`} + drag`,
                          ],
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
                label="Export"
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
                    <path d="M7 2v7" />
                    <path d="M4.5 7 7 10l2.5-3" />
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
              >
                <div ref={exportContentRef} className="space-y-2">
                  {/* Format + transparent + export on one row */}
                  <div className="flex items-center gap-1.5">
                    {/* Format pills */}
                    <div className={`flex rounded overflow-hidden border ${isDark ? "border-white/10" : "border-black/10"}`}>
                      {(["PNG", "SVG"] as const).map((fmt) => {
                        const active = exportFormat === fmt.toLowerCase();
                        return (
                          <button
                            key={fmt}
                            onClick={() => onSetExportFormat(fmt.toLowerCase() as "png" | "svg")}
                            className={`px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none ${
                              active
                                ? isDark ? "bg-white/15 text-white" : "bg-black/10 text-black"
                                : isDark ? "text-white/40 hover:text-white/70" : "text-black/35 hover:text-black/60"
                            }`}
                          >
                            {fmt}
                          </button>
                        );
                      })}
                    </div>
                    {/* Transparent toggle */}
                    <button
                      onClick={() => onSetExportTransparentBg(!exportTransparentBg)}
                      title="Transparent background"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors focus:outline-none border ${
                        exportTransparentBg
                          ? isDark ? "bg-white/15 text-white border-white/20" : "bg-black/10 text-black border-black/15"
                          : isDark ? "text-white/40 border-white/10 hover:text-white/70" : "text-black/35 border-black/10 hover:text-black/60"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="2" width="12" height="10" rx="1.5" />
                        <rect x="1" y="2" width="6" height="5" rx="1.5 0 0 0" fill="currentColor" fillOpacity="0.2" stroke="none" />
                        <rect x="7" y="7" width="6" height="5" rx="0 0 1.5 0" fill="currentColor" fillOpacity="0.2" stroke="none" />
                        <line x1="1" y1="7" x2="13" y2="7" strokeOpacity="0.3" />
                        <line x1="7" y1="2" x2="7" y2="12" strokeOpacity="0.3" />
                      </svg>
                      <span>Transparent</span>
                    </button>
                    {/* Export button */}
                    <button
                      onClick={() => onExport(exportFormat, exportTransparentBg)}
                      className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors focus:outline-none ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/10 text-black hover:bg-black/15"}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 2v8" />
                        <path d="M4.5 8 7 11l2.5-3" />
                        <line x1="2" y1="13" x2="12" y2="13" />
                      </svg>
                      Export
                    </button>
                  </div>
                  {/* Save / Load data row */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          label: "Save data",
                          onClick: onExportData,
                          icon: (
                            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 2v7" />
                              <path d="M4.5 7 7 10l2.5-3" />
                              <line x1="2" y1="12.5" x2="12" y2="12.5" />
                            </svg>
                          ),
                        },
                        {
                          label: "Load data",
                          onClick: onImportData,
                          icon: (
                            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 9V2" />
                              <path d="M4.5 4.5 7 2l2.5 2.5" />
                              <line x1="2" y1="12.5" x2="12" y2="12.5" />
                            </svg>
                          ),
                        },
                      ] as { label: string; onClick: () => void; icon: React.ReactNode }[]
                    ).map(({ label, onClick, icon }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded transition-colors focus:outline-none ${isDark ? "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white" : "bg-black/5 text-black/50 hover:bg-black/10 hover:text-black"}`}
                      >
                        {icon}
                        <span className="text-[10px] leading-none">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                label="About"
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
                    drawtool started as a personal tool &mdash; a drawing canvas
                    that stays out of the way.
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

            <div
              className={`mt-3 pt-2 border-t text-center ${isDark ? "border-white/10" : "border-black/10"}`}
            >
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
