import { useState, useRef, useEffect } from "react";
import type { Settings, Theme, TextSize, GridType } from "../hooks/useSettings";

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight" || theme === "lumber";
}

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  onExport: () => void;
  onExportTransparent: () => void;
  onClear: () => void;
  hasTouch: boolean;
  activeCanvas: number;
  onSwitchCanvas: (n: number) => void;
  onToggleFullscreen: () => void;
  onResetView: () => void;
};

const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "\u2318" : "Ctrl";
const alt = isMac ? "\u2325" : "Alt";

export default function Menu({
  settings,
  updateSettings,
  onExport,
  onExportTransparent,
  onClear,
  hasTouch,
  activeCanvas,
  onSwitchCanvas,
  onToggleFullscreen,
  onResetView,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [clearWipe, setClearWipe] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  const isDark = isDarkTheme(settings.theme);

  useEffect(() => {
    const onToggle = () =>
      setOpen((o) => {
        if (o) {
          setShowInfo(false);
          setShowAbout(false);
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
        setShowAbout(false);
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
    setShowAbout(false);
    setClearWipe(0);
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
          className={`w-8 h-8 flex items-center justify-center rounded-lg border backdrop-blur-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${open ? (isDark ? "bg-white/20 border-white/30 text-white" : "bg-black/20 border-black/30 text-black") : isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
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
            className={`mt-2 p-3 rounded-lg border backdrop-blur-sm w-[min(340px,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden ${hasTouch ? "max-h-[calc(100dvh-8rem)]" : "max-h-[calc(100vh-8rem)]"} ${settings.theme === "midnight" ? "border-white/15" : isDark ? `${hasTouch ? "bg-black/90" : "bg-black/70"} border-white/15` : `${hasTouch ? "bg-white/90" : "bg-white/70"} border-black/15`}`}
            style={
              settings.theme === "midnight"
                ? {
                    background: hasTouch
                      ? "rgba(15,15,30,0.95)"
                      : "rgba(15,15,30,0.85)",
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
            <div className="flex items-center justify-between text-sm">
              <span>Line thickness</span>
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

            <div className="flex items-center justify-between text-sm mt-4">
              <span>Dash gap</span>
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

            <div className="mt-4 text-sm">Color</div>
            <div className="flex gap-1.5 mt-1.5 justify-center">
              {palette.map((color) => (
                <button
                  key={color}
                  onClick={() => updateSettings({ lineColor: color })}
                  aria-label={`Color ${color}`}
                  aria-pressed={settings.lineColor === color}
                  className="w-5 h-5 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-blue-400"
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
                <div className="text-sm mt-4">Text size</div>
                <div className="flex items-center gap-1 mt-2">
                  {(["xs", "s", "m", "l", "xl"] as TextSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ textSize: size })}
                      aria-label={`Text size ${size.toUpperCase()}`}
                      aria-pressed={settings.textSize === size}
                      className={`flex-1 flex items-center justify-center py-1 rounded text-xs font-medium transition-all duration-150 ${
                        settings.textSize === size
                          ? isDark
                            ? "bg-white/20 text-white"
                            : "bg-black/15 text-black"
                          : isDark
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 text-sm">Shape</div>
            <div className="flex gap-1.5 mt-1.5 justify-center">
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
                  "lightning",
                ] as const
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSettings({ activeShape: s })}
                  aria-label={s.charAt(0).toUpperCase() + s.slice(1)}
                  aria-pressed={settings.activeShape === s}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    settings.activeShape === s
                      ? isDark
                        ? "bg-white/20"
                        : "bg-black/15"
                      : isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-black/10"
                  }`}
                  title={s.charAt(0).toUpperCase() + s.slice(1)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={isDark ? "white" : "black"}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeOpacity={settings.activeShape === s ? 1 : 0.6}
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
                    {s === "lightning" && (
                      <polygon points="9,1 3,8.5 7.5,8.5 6,15 13,7 8.5,7" />
                    )}
                  </svg>
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm">Canvas</div>
            <div className="flex gap-1 mt-1.5 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => onSwitchCanvas(n)}
                  aria-label={`Canvas ${n}`}
                  aria-pressed={activeCanvas === n}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    activeCanvas === n
                      ? isDark
                        ? "bg-white/20 text-white"
                        : "bg-black/15 text-black"
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
                setClearWipe((n) => n + 1);
                onClear();
              }}
              className={`mt-4 w-full py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 relative overflow-hidden ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
            >
              {clearWipe > 0 && (
                <span
                  key={clearWipe}
                  className={`absolute inset-0 animate-wipe rounded ${isDark ? "bg-white/15" : "bg-black/10"}`}
                />
              )}
              <span className="relative">Clear screen</span>
            </button>

            <div className="mt-4 text-sm">Theme</div>
            <div className="grid grid-cols-3 gap-x-1 gap-y-2 mt-1.5">
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
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-all outline-none ${
                    settings.theme === t.id ? "" : "opacity-60 hover:opacity-90"
                  }`}
                  style={{
                    backgroundColor: t.bg,
                    color: t.text,
                    boxShadow:
                      settings.theme === t.id
                        ? `inset 0 0 0 2px ${t.text}40`
                        : undefined,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span>Grid</span>
              <div
                className={`flex rounded overflow-hidden border ${isDark ? "border-white/15" : "border-black/15"}`}
              >
                {(["off", "dot", "square"] as GridType[]).map((g) => {
                  const dotColor = isDark
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(0,0,0,0.18)";
                  const sqColor = isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.08)";
                  const bgPattern =
                    g === "dot"
                      ? {
                          backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
                          backgroundSize: "7px 7px",
                        }
                      : g === "square"
                        ? {
                            backgroundImage: `linear-gradient(to right, ${sqColor} 1px, transparent 1px), linear-gradient(to bottom, ${sqColor} 1px, transparent 1px)`,
                            backgroundSize: "7px 7px",
                          }
                        : {};
                  return (
                    <button
                      key={g}
                      onClick={() => updateSettings({ gridType: g })}
                      aria-pressed={settings.gridType === g}
                      style={bgPattern}
                      className={`px-5 py-1.5 text-xs transition-colors ${
                        settings.gridType === g
                          ? isDark
                            ? "bg-white/20 text-white"
                            : "bg-black/15 text-black"
                          : isDark
                            ? "text-white/50 hover:bg-white/10"
                            : "text-black/50 hover:bg-black/8"
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  );
                })}
              </div>
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
                Fullscreen
              </button>
            )}

            <div className="mt-4 space-y-3">
              {[
                ...(!hasTouch
                  ? [
                      {
                        label: "Zoom controls",
                        key: "showZoomControls" as const,
                        value: settings.showZoomControls,
                      },
                    ]
                  : []),
                ...(!hasTouch
                  ? [
                      {
                        label: "Confirm clear",
                        key: "confirmClear" as const,
                        value: settings.confirmClear,
                      },
                    ]
                  : []),
                {
                  label: "Dynamic stroke",
                  key: "pressureSensitivity" as const,
                  value: settings.pressureSensitivity,
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  role="switch"
                  aria-checked={opt.value}
                  onClick={() => updateSettings({ [opt.key]: !opt.value })}
                  className="flex items-center justify-between w-full text-sm cursor-pointer group"
                >
                  <span>{opt.label}</span>
                  <span
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      opt.value
                        ? "bg-blue-500"
                        : isDark
                          ? "bg-white/15 group-hover:bg-white/25"
                          : "bg-black/12 group-hover:bg-black/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${
                        opt.value
                          ? "translate-x-[16px] bg-white"
                          : isDark
                            ? "bg-white/70"
                            : "bg-white"
                      }`}
                    />
                  </span>
                </button>
              ))}
              <div className="flex items-center gap-3 text-sm">
                <span>Export</span>
                <div className="flex gap-1 flex-1">
                  <button
                    onClick={onExport}
                    className={`flex-1 py-1 rounded text-xs transition-colors ${isDark ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white" : "bg-black/5 text-black/60 hover:bg-black/10 hover:text-black"}`}
                  >
                    With background
                  </button>
                  <button
                    onClick={onExportTransparent}
                    className={`flex-1 py-1 rounded text-xs transition-colors ${isDark ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white" : "bg-black/5 text-black/60 hover:bg-black/10 hover:text-black"}`}
                  >
                    Transparent
                  </button>
                </div>
              </div>
            </div>

            {!hasTouch && (
              <>
                <button
                  onClick={() =>
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
                  className={`mt-4 flex items-center gap-1.5 text-xs transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${showInfo ? "rotate-90" : ""}`}
                  >
                    <path d="M3.5 1.5L7 5L3.5 8.5" />
                  </svg>
                  Shortcuts
                </button>

                {showInfo && (
                  <div
                    ref={infoRef}
                    className={`mt-2 pt-2 border-t ${isDark ? "border-white/10" : "border-black/10"}`}
                  >
                    <div
                      className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}
                    >
                      <div
                        className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Navigation
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
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
                            Pan
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Space + drag / Arrows
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <circle cx="7" cy="7" r="5" />
                              <line x1="10.5" y1="10.5" x2="14" y2="14" />
                            </svg>
                            Zoom
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Pinch / {mod} + scroll
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <circle cx="7" cy="7" r="5" />
                              <line x1="10.5" y1="10.5" x2="14" y2="14" />
                              <line x1="5" y1="7" x2="9" y2="7" />
                              <line x1="7" y1="5" x2="7" y2="9" />
                            </svg>
                            Zoom in
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            +
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <circle cx="7" cy="7" r="5" />
                              <line x1="10.5" y1="10.5" x2="14" y2="14" />
                              <line x1="5" y1="7" x2="9" y2="7" />
                            </svg>
                            Zoom out
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            -
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M2,8 L14,8 M8,2 L8,14" />
                              <rect
                                x="4"
                                y="4"
                                width="8"
                                height="8"
                                rx="0.5"
                                strokeDasharray="1.5 1.5"
                              />
                            </svg>
                            Reset zoom
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + 0
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="2" width="12" height="12" rx="1" />
                              <path
                                d="M5,6 L8,4 L11,6 L11,10 L8,12 L5,10 Z"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Fit to content
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + 1
                          </kbd>
                        </div>
                      </div>

                      <div
                        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Drawing
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
                            </svg>
                            Draw
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Click / {mod} + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeDasharray="2 2.5"
                            >
                              <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
                            </svg>
                            Draw dashed
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Shift + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
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
                            Straight line
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + Shift + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <defs>
                                <linearGradient
                                  id="eg"
                                  x1="0"
                                  y1="0"
                                  x2="1"
                                  y2="0"
                                >
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
                                fill="url(#eg)"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeOpacity="0.5"
                              />
                            </svg>
                            Erase
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {alt} + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              stroke="none"
                              opacity="0.5"
                            >
                              <rect x="2" y="5" width="12" height="6" rx="1" />
                            </svg>
                            Highlight
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            W/H + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              stroke="none"
                            >
                              <path d="M2,8 L14,5 L14,11 Z" opacity="0.7" />
                            </svg>
                            Dynamic stroke
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            P
                          </kbd>
                        </div>
                      </div>

                      <div
                        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Shapes
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span>Draw shape</span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {isMac ? "Ctrl" : `${alt} + Shift`} + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Cycle shape</span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            S
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <rect
                                x="2"
                                y="3"
                                width="12"
                                height="10"
                                rx="0.5"
                              />
                            </svg>
                            Rectangle
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            R + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <circle cx="8" cy="8" r="6" />
                            </svg>
                            Circle
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            C + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <line x1="2" y1="8" x2="12" y2="8" />
                              <polyline
                                points="9,5 12,8 9,11"
                                strokeLinecap="round"
                              />
                            </svg>
                            Arrow
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            A + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                            >
                              <rect
                                x="2"
                                y="3"
                                width="12"
                                height="10"
                                rx="0.5"
                              />
                            </svg>
                            Dashed shape
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {isMac ? "Shift + Ctrl" : `Shift + ${alt}`} + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 16 16">
                              <rect
                                x="2"
                                y="3"
                                width="12"
                                height="10"
                                rx="0.5"
                                fill="currentColor"
                                fillOpacity="0.4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                            </svg>
                            Filled shape
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {isMac ? "F + Ctrl" : `F + ${alt}`} + drag
                          </kbd>
                        </div>
                      </div>

                      <div
                        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Tools
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
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
                            Laser pointer
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Q/L + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
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
                              <path d="M4,6 C4,3 8,2 11,4" />
                              <polyline points="2,6.5 4,6 5.5,8" />
                            </svg>
                            Undo
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            U / {mod} + Z
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
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
                              <path d="M12,6 C12,3 8,2 5,4" />
                              <polyline points="14,6.5 12,6 10.5,8" />
                            </svg>
                            Redo
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Shift + U / {mod} + Shift + Z
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              stroke="none"
                            >
                              <circle cx="4" cy="8" r="2.5" opacity="0.4" />
                              <circle cx="11" cy="8" r="2.5" />
                            </svg>
                            Next / Prev color
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            ] / [
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              stroke="none"
                            >
                              <circle cx="5" cy="8" r="2.5" />
                              <path
                                d="M9.5 6.5 L12.5 8 L9.5 9.5"
                                opacity="0.4"
                              />
                              <path
                                d="M12.5 6.5 L9.5 8 L12.5 9.5"
                                opacity="0.4"
                              />
                            </svg>
                            Swap last 2 colors
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            ,
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="12"
                                height="12"
                                rx="1.5"
                              />
                              <line x1="6" y1="5" x2="6" y2="11" />
                              <line x1="10" y1="5" x2="10" y2="11" />
                              <line x1="2" y1="8" x2="14" y2="8" />
                            </svg>
                            Switch canvas
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            1 – 9
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="12"
                                height="12"
                                rx="1.5"
                              />

                              <text
                                x="8"
                                y="8.5"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="currentColor"
                                stroke="none"
                                fontSize="6.5"
                                fontWeight="600"
                                fontFamily="system-ui, -apple-system, sans-serif"
                              >
                                Aa
                              </text>
                            </svg>
                            Rename canvas
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + ,
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <line x1="4" y1="8" x2="12" y2="8" />
                            </svg>
                            Thicker / Thinner
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {"{ / }"}
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              stroke="none"
                            >
                              <circle cx="8" cy="8" r="3" />
                            </svg>
                            Place dot
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            .
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M3 3h6M6 3v8M4.5 3v1M7.5 3v1" />
                            </svg>
                            Write text
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            T
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M3 3h6M6 3v8M4.5 3v1M7.5 3v1" />
                              <path d="M10 6l2 2-2 2" strokeWidth="1.2" />
                            </svg>
                            Cycle text size
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            Shift + T
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <line x1="4" y1="4" x2="12" y2="12" />
                              <line x1="4" y1="12" x2="12" y2="4" />
                            </svg>
                            Clear canvas
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + X
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M3 13h10M8 3v7M5 7l3 3 3-3" />
                            </svg>
                            Export
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + E
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <line x1="3" y1="4" x2="13" y2="4" />
                              <line x1="3" y1="8" x2="13" y2="8" />
                              <line x1="3" y1="12" x2="13" y2="12" />
                            </svg>
                            Menu
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            M
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="12"
                                height="12"
                                rx="1.5"
                              />
                              <path d="M2,6 L6,6 L6,2 M10,2 L10,6 L14,6 M14,10 L10,10 L10,14 M6,14 L6,10 L2,10" />
                            </svg>
                            Fullscreen
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            {mod} + F
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <line
                                x1="4"
                                y1="2"
                                x2="4"
                                y2="14"
                                strokeOpacity="0.5"
                              />
                              <line
                                x1="8"
                                y1="2"
                                x2="8"
                                y2="14"
                                strokeOpacity="0.5"
                              />
                              <line
                                x1="12"
                                y1="2"
                                x2="12"
                                y2="14"
                                strokeOpacity="0.5"
                              />
                              <line
                                x1="2"
                                y1="4"
                                x2="14"
                                y2="4"
                                strokeOpacity="0.5"
                              />
                              <line
                                x1="2"
                                y1="8"
                                x2="14"
                                y2="8"
                                strokeOpacity="0.5"
                              />
                              <line
                                x1="2"
                                y1="12"
                                x2="14"
                                y2="12"
                                strokeOpacity="0.5"
                              />
                            </svg>
                            Cycle grid
                          </span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            G
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Cycle theme</span>
                          <kbd
                            className={
                              isDark ? "text-white/40" : "text-black/40"
                            }
                          >
                            D D
                          </kbd>
                        </div>
                      </div>
                      <div
                        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
                      >
                        Selection
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" />
                              <path d="M8 5v6M5 8h6" strokeWidth="1.2" />
                            </svg>
                            Select / move / resize
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            V + hold
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" />
                            </svg>
                            Box select
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            V + drag
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <circle cx="8" cy="8" r="5" />
                              <circle cx="8" cy="8" r="2" strokeOpacity="0.5" />
                            </svg>
                            Cycle overlapping
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            Click again
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="2" width="12" height="12" rx="1" />
                              <path d="M5 8h6" strokeWidth="1.2" />
                            </svg>
                            Select all
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            {mod} + A
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="4" width="8" height="10" rx="1" />
                              <path d="M6 4V2.5A.5.5 0 016.5 2h7a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H12" strokeOpacity="0.5" />
                            </svg>
                            Copy
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            {mod} + C
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="2" y="4" width="8" height="10" rx="1" />
                              <path d="M10 2h2.5a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H10" strokeOpacity="0.5" />
                              <path d="M5 9l2 2 4-4" strokeWidth="1.2" />
                            </svg>
                            Paste
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            {mod} + V
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M4 4l8 8M4 12l8-8" strokeWidth="1.2" />
                              <rect x="2" y="2" width="12" height="12" rx="1" strokeOpacity="0.3" />
                            </svg>
                            Cut
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            {mod} + X
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <rect x="1.5" y="3.5" width="8" height="10" rx="1" />
                              <rect x="6.5" y="1.5" width="8" height="10" rx="1" strokeOpacity="0.5" />
                            </svg>
                            Duplicate
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            {mod} + D
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <line x1="4" y1="4" x2="12" y2="12" />
                              <line x1="4" y1="12" x2="12" y2="4" />
                            </svg>
                            Delete
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            Backspace
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M8 3v10M3 8h10" />
                            </svg>
                            Nudge
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            ↑ ↓ ← →
                          </kbd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M3 8h10M8 3v10" strokeOpacity="0.4" />
                              <circle cx="8" cy="8" r="3" />
                            </svg>
                            Deselect
                          </span>
                          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
                            Escape
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() =>
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
              className={`mt-4 flex items-center gap-1.5 text-xs transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showAbout ? "rotate-90" : ""}`}
              >
                <path d="M3.5 1.5L7 5L3.5 8.5" />
              </svg>
              About
            </button>

            {showAbout && (
              <div
                ref={aboutRef}
                className={`mt-2 pt-2 border-t text-xs leading-relaxed break-words ${isDark ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}
              >
                <p>drawtool was built out of a need for three things:</p>
                <ul className="mt-1.5 list-disc list-inside space-y-1">
                  <li>
                    A classic freehand whiteboard &mdash; simple to draw on, no
                    bloat.
                  </li>
                  <li>
                    A keyboard-first experience. Drawing by clicking and
                    dragging (especially on a trackpad) is painful, so every
                    action is a modifier key away.
                  </li>
                  <li>
                    Shortcuts for everything &mdash; solid lines, dashed lines,
                    straight lines, eraser, colors, thickness, undo, redo.
                  </li>
                </ul>
              </div>
            )}

            <div
              className={`mt-2 pt-2 border-t text-center ${isDark ? "border-white/10" : "border-black/10"}`}
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
