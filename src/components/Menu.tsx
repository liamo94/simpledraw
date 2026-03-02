import { useState, useRef, useEffect } from "react";
import type { Settings, Theme, TextSize, GridType, FontFamily, TextAlign } from "../hooks/useSettings";
import ShortcutsPanel from "./ShortcutsPanel";

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight" || theme === "lumber" || theme === "slate";
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
  onExportData: () => void;
  onImportData: () => void;
};

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
  onExportData,
  onImportData,
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
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Line thickness</span>
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
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Dash gap</span>
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

            <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Color</div>
            <div className="flex gap-1.5 mt-1.5 justify-center">
              {palette.map((color) => (
                <button
                  key={color}
                  onClick={() => window.dispatchEvent(new CustomEvent("drawtool:set-color", { detail: color }))}
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
                <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Text size</div>
                <div className="flex items-center gap-1 mt-2">
                  {(["xs", "s", "m", "l", "xl"] as TextSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ textSize: size })}
                      aria-label={`Text size ${size.toUpperCase()}`}
                      aria-pressed={settings.textSize === size}
                      className={`flex-1 flex items-center justify-center py-1 rounded text-xs font-medium transition-all duration-150 ${
                        settings.textSize === size
                          ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                          : isDark
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Font</div>
                <div className="flex items-center gap-1 mt-2">
                  {(
                    [
                      { key: "caveat",   label: "Abc", css: "'Caveat', cursive" },
                      { key: "comic",    label: "Abc", css: "'Bangers', cursive" },
                      { key: "cartoon",  label: "Abc", css: "'Boogaloo', cursive" },
                      { key: "sans",     label: "Abc", css: "system-ui, -apple-system, sans-serif" },
                      { key: "serif",    label: "Abc", css: "Georgia, serif" },
                      { key: "mono",     label: "Abc", css: "ui-monospace, 'Courier New', monospace" },
                    ] as { key: FontFamily; label: string; css: string }[]
                  ).map(({ key, label, css }) => (
                    <button
                      key={key}
                      onClick={() => window.dispatchEvent(new CustomEvent("drawtool:font-family", { detail: key }))}
                      aria-label={`Font ${key}`}
                      aria-pressed={settings.fontFamily === key}
                      style={{ fontFamily: css }}
                      className={`flex-1 flex items-center justify-center py-1 rounded text-base transition-all duration-150 ${
                        settings.fontFamily === key
                          ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                          : isDark
                            ? "text-white/40 hover:text-white/60"
                            : "text-black/35 hover:text-black/55"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {/* Bold */}
                  <button
                    onClick={() => window.dispatchEvent(new Event("drawtool:text-bold"))}
                    aria-label="Bold"
                    aria-pressed={settings.textBold}
                    className={`flex-1 flex items-center justify-center py-1 rounded text-sm font-bold transition-all duration-150 ${
                      settings.textBold
                        ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                        : isDark ? "text-white/40 hover:text-white/60" : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    B
                  </button>
                  {/* Italic */}
                  <button
                    onClick={() => window.dispatchEvent(new Event("drawtool:text-italic"))}
                    aria-label="Italic"
                    aria-pressed={settings.textItalic}
                    className={`flex-1 flex items-center justify-center py-1 rounded text-sm italic transition-all duration-150 ${
                      settings.textItalic
                        ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                        : isDark ? "text-white/40 hover:text-white/60" : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    I
                  </button>
                  {/* Align Left */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("drawtool:text-align", { detail: "left" as TextAlign }))}
                    aria-label="Align left"
                    aria-pressed={settings.textAlign === "left"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "left"
                        ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                        : isDark ? "text-white/40 hover:text-white/60" : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="1" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="1" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                  {/* Align Center */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("drawtool:text-align", { detail: "center" as TextAlign }))}
                    aria-label="Align center"
                    aria-pressed={settings.textAlign === "center"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "center"
                        ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                        : isDark ? "text-white/40 hover:text-white/60" : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="3" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="2" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                  {/* Align Right */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("drawtool:text-align", { detail: "right" as TextAlign }))}
                    aria-label="Align right"
                    aria-pressed={settings.textAlign === "right"}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-all duration-150 ${
                      settings.textAlign === "right"
                        ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
                        : isDark ? "text-white/40 hover:text-white/60" : "text-black/35 hover:text-black/55"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                      <rect x="5" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="3" y="9" width="10" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Shape</div>
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
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors focus:outline-none ${
                    settings.activeShape === s
                      ? isDark
                        ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50"
                        : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
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
                    stroke={settings.activeShape === s ? (isDark ? "#5dd8e8" : "#00618c") : (isDark ? "white" : "black")}
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
                    {s === "lightning" && (
                      <polygon points="9,1 3,8.5 7.5,8.5 6,15 13,7 8.5,7" />
                    )}
                  </svg>
                </button>
              ))}
            </div>

            <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Canvas</div>
            <div className="flex gap-1 mt-1.5 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => onSwitchCanvas(n)}
                  aria-label={`Canvas ${n}`}
                  aria-pressed={activeCanvas === n}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm tabular-nums transition-colors focus:outline-none ${
                    activeCanvas === n
                      ? isDark ? "bg-[#00618c]/20 text-[#5dd8e8] ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 text-[#00618c] ring-1 ring-[#00618c]/40"
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
              <svg className="relative" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="4.5" x2="14" y2="4.5"/>
                <path d="M5.5 4.5V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1.5"/>
                <path d="M3.5 4.5L4.2 13a.5.5 0 0 0 .5.5h6.6a.5.5 0 0 0 .5-.5l.7-8.5"/>
                <line x1="6.5" y1="7.5" x2="6.5" y2="11"/>
                <line x1="9.5" y1="7.5" x2="9.5" y2="11"/>
              </svg>
              <span className="relative">Clear screen</span>
            </button>

            <div className={`mt-5 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Theme</div>
            <div className="flex gap-2 mt-1.5">
              {[
                { id: "dark" as const,     label: "Black",    bg: "#06060e", text: "#ffffff" },
                { id: "midnight" as const, label: "Midnight", bg: "#1a1a2e", text: "#ffffff" },
                { id: "lumber" as const,   label: "Lumber",   bg: "#110e0a", text: "#e8d5c0" },
                { id: "slate" as const,    label: "Slate",    bg: "#1c2128", text: "#adbac7" },
                { id: "journal" as const,  label: "Journal",  bg: "#f5e2b8", text: "#000000" },
                { id: "sky" as const,      label: "Sky",      bg: "#e0ecf6", text: "#1a3a5c" },
                { id: "sand" as const,     label: "Sand",     bg: "#f5e8dc", text: "#4a3520" },
                { id: "white" as const,    label: "White",    bg: "#f5f5f0", text: "#000000" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  aria-label={`${t.label} theme`}
                  aria-pressed={settings.theme === t.id}
                  className={`w-7 h-7 rounded-md outline-none transition-[opacity,transform] duration-150 ${
                    settings.theme === t.id ? "opacity-100 scale-110" : "opacity-45 hover:opacity-75"
                  }`}
                  style={{
                    backgroundColor: t.bg,
                    boxShadow: `inset 0 0 0 1px ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}`,
                  }}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Grid</span>
              <div
                className={`flex rounded overflow-hidden border ${isDark ? "border-white/15" : "border-black/15"}`}
              >
                {(["off", "dot", "square"] as GridType[]).map((g) => {
                  const active = settings.gridType === g;
                  const iconColor = active
                    ? isDark ? "#5dd8e8" : "#00618c"
                    : isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
                  const icon =
                    g === "off" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <line x1="4" y1="4" x2="12" y2="12" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="12" y1="4" x2="4" y2="12" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ) : g === "dot" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill={iconColor}>
                        <circle cx="4" cy="4" r="1.2"/><circle cx="8" cy="4" r="1.2"/><circle cx="12" cy="4" r="1.2"/>
                        <circle cx="4" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12" cy="8" r="1.2"/>
                        <circle cx="4" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={iconColor} strokeWidth="0.9">
                        <line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="1" y1="10.5" x2="15" y2="10.5"/>
                        <line x1="5.5" y1="1" x2="5.5" y2="15"/><line x1="10.5" y1="1" x2="10.5" y2="15"/>
                      </svg>
                    );
                  return (
                    <button
                      key={g}
                      onClick={() => updateSettings({ gridType: g })}
                      aria-pressed={active}
                      title={g.charAt(0).toUpperCase() + g.slice(1)}
                      className={`w-10 h-8 flex items-center justify-center transition-colors ${
                        active
                          ? isDark ? "bg-[#00618c]/20 ring-1 ring-[#00618c]/50" : "bg-[#00618c]/12 ring-1 ring-[#00618c]/40"
                          : isDark ? "hover:bg-white/10" : "hover:bg-black/8"
                      }`}
                    >
                      {icon}
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
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6V2h4"/>
                  <path d="M10 2h4v4"/>
                  <path d="M14 10v4h-4"/>
                  <path d="M6 14H2v-4"/>
                </svg>
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
                        ? "bg-[#00618c]"
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
            </div>

            <div className={`mt-5 mb-2 text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-white/40" : "text-black/40"}`}>Export</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  {
                    label: "PNG",
                    onClick: onExport,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="2" width="12" height="10" rx="1.5"/>
                        <path d="M3 9.5 5.5 6.5 7.5 8.5 9 7 11 9.5" strokeLinejoin="round"/>
                        <circle cx="10" cy="4.5" r="1.2" fill="currentColor" stroke="none"/>
                      </svg>
                    ),
                  },
                  {
                    label: "Transparent",
                    onClick: onExportTransparent,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="2" width="12" height="10" rx="1.5"/>
                        <rect x="1" y="2" width="6" height="5" rx="1.5 0 0 0" fill="currentColor" fillOpacity="0.15" stroke="none"/>
                        <rect x="7" y="7" width="6" height="5" rx="0 0 1.5 0" fill="currentColor" fillOpacity="0.15" stroke="none"/>
                        <line x1="1" y1="7" x2="13" y2="7" strokeOpacity="0.25"/>
                        <line x1="7" y1="2" x2="7" y2="12" strokeOpacity="0.25"/>
                      </svg>
                    ),
                  },
                  {
                    label: "Save data",
                    onClick: onExportData,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 2v7"/>
                        <path d="M4.5 7 7 10l2.5-3"/>
                        <line x1="2" y1="12.5" x2="12" y2="12.5"/>
                      </svg>
                    ),
                  },
                  {
                    label: "Load data",
                    onClick: onImportData,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 9V2"/>
                        <path d="M4.5 4.5 7 2l2.5 2.5"/>
                        <line x1="2" y1="12.5" x2="12" y2="12.5"/>
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
                    <ShortcutsPanel isDark={isDark} />
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
