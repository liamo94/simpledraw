import { useState, useRef, useEffect } from "react";
import type { Settings, Theme } from "../hooks/useSettings";

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight";
}

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  onExport: () => void;
  onExportTransparent: () => void;
  onClear: () => void;
  zoom: number;
  onResetView: () => void;
  hasTouch: boolean;
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
  zoom,
  onResetView,
  hasTouch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDark = isDarkTheme(settings.theme);

  useEffect(() => {
    const onToggle = () =>
      setOpen((o) => {
        if (o) {
          setShowInfo(false);
          setShowAbout(false);
        }
        return !o;
      });
    window.addEventListener("simpledraw:toggle-menu", onToggle);
    return () => window.removeEventListener("simpledraw:toggle-menu", onToggle);
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

    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInfo(false);
        setShowAbout(false);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const defaultLineColor = isDark ? "#ffffff" : "#000000";

  const palette = [
    isDark ? "#ffffff" : "#000000",
    "#ef4444",
    "#ec4899",
    "#22c55e",
    "#84cc16",
    "#3b82f6",
    "#eab308",
    "#f97316",
    "#8b5cf6",
    "#06b6d4",
    "#92400e",
    "#4b5563",
  ];

  return (
    <div
      ref={menuRef}
      className="fixed top-4 right-4 z-50 flex flex-col items-end"
    >
      <button
        onClick={() =>
          setOpen((o) => {
            if (o) {
              setShowInfo(false);
              setShowAbout(false);
            }
            return !o;
          })
        }
        className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${isDark ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20" : "bg-black/10 border-black/20 text-black/70 hover:text-black hover:bg-black/20"}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path
            d="M8 3.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
            fill="currentColor"
            stroke="none"
          />
          <path
            d="M8 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
            fill="currentColor"
            stroke="none"
          />
          <path
            d="M8 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`mt-2 p-3 rounded-lg border backdrop-blur-sm min-w-[340px] max-w-[360px] overflow-y-auto ${hasTouch ? "max-h-[calc(100dvh-8rem)]" : "max-h-[calc(100vh-5rem)]"} ${isDark ? "bg-black/70 border-white/15" : "bg-white/70 border-black/15"}`}
        >
          <div
            className={`text-lg mb-3 text-center ${isDark ? "text-white/90" : "text-black/90"}`}
            style={{ fontFamily: "Pacifico, cursive" }}
          >
            simpledraw
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Thickness</span>
            <span
              className={`text-xs tabular-nums w-3 text-right ${isDark ? "text-white/50" : "text-black/50"}`}
            >
              {settings.lineWidth}
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.lineWidth}
            onChange={(e) =>
              updateSettings({ lineWidth: Number(e.target.value) })
            }
            className={`w-full mt-1.5 ${isDark ? "accent-white/70" : "accent-black/70"}`}
          />

          <label className="flex items-center justify-between gap-3 text-sm mt-3">
            <span>Dash gap</span>
            <span
              className={`text-xs tabular-nums w-3 text-right ${isDark ? "text-white/50" : "text-black/50"}`}
            >
              {settings.dashGap}
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.dashGap}
            onChange={(e) =>
              updateSettings({ dashGap: Number(e.target.value) })
            }
            className={`w-full mt-1.5 ${isDark ? "accent-white/70" : "accent-black/70"}`}
          />

          <div className="mt-3 text-sm">Shape</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap justify-center">
            {(["rectangle", "circle", "triangle", "diamond", "pentagon", "hexagon", "octagon", "star", "arrow"] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateSettings({ activeShape: s })}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                  settings.activeShape === s
                    ? isDark
                      ? "bg-white/20"
                      : "bg-black/20"
                    : isDark
                      ? "bg-white/5 hover:bg-white/10"
                      : "bg-black/5 hover:bg-black/10"
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
                  {s === "rectangle" && <rect x="2" y="3" width="12" height="10" rx="0.5" />}
                  {s === "circle" && <circle cx="8" cy="8" r="6" />}
                  {s === "triangle" && <polygon points="8,2 14,14 2,14" />}
                  {s === "diamond" && <polygon points="8,1 15,8 8,15 1,8" />}
                  {s === "pentagon" && <polygon points="8,2 14.5,6.5 12,14 4,14 1.5,6.5" />}
                  {s === "hexagon" && <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" />}
                  {s === "octagon" && <polygon points="5,2 11,2 14,5 14,11 11,14 5,14 2,11 2,5" />}
                  {s === "star" && <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" />}
                  {s === "arrow" && (
                    <>
                      <line x1="2" y1="8" x2="12" y2="8" />
                      <polyline points="9,5 12,8 9,11" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </button>
            ))}
          </div>

          <div className="mt-3 text-sm">Color</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {palette.map((color) => (
              <button
                key={color}
                onClick={() => updateSettings({ lineColor: color })}
                className="w-5 h-5 rounded-full border-2 transition-transform"
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

          <button
            onClick={onClear}
            className={`mt-3 w-full py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
          >
            Clear screen
          </button>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <span>Export</span>
            <div className="flex gap-1 flex-1">
              <button
                onClick={onExport}
                className={`flex-1 py-1 rounded text-xs transition-colors ${isDark ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white" : "bg-black/5 text-black/60 hover:bg-black/10 hover:text-black"}`}
              >
                PNG
              </button>
              <button
                onClick={onExportTransparent}
                className={`flex-1 py-1 rounded text-xs transition-colors ${isDark ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white" : "bg-black/5 text-black/60 hover:bg-black/10 hover:text-black"}`}
              >
                Transparent
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Zoom</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs tabular-nums ${isDark ? "text-white/50" : "text-black/50"}`}
              >
                {Math.round(zoom * 100)}%
              </span>
              {zoom !== 1 && (
                <button
                  onClick={onResetView}
                  className={`text-xs transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <label className="mt-1.5 flex items-center justify-between text-sm cursor-pointer">
            <span>Zoom controls</span>
            <input
              type="checkbox"
              checked={settings.showZoomControls}
              onChange={(e) =>
                updateSettings({ showZoomControls: e.target.checked })
              }
              className={
                settings.showZoomControls
                  ? "accent-blue-500"
                  : isDark
                    ? "accent-white/70"
                    : "accent-black/70"
              }
            />
          </label>

          <label className="mt-1.5 flex items-center justify-between text-sm cursor-pointer">
            <span>Dot grid</span>
            <input
              type="checkbox"
              checked={settings.showDotGrid}
              onChange={(e) =>
                updateSettings({ showDotGrid: e.target.checked })
              }
              className={
                settings.showZoomControls
                  ? "accent-blue-500"
                  : isDark
                    ? "accent-white/70"
                    : "accent-black/70"
              }
            />
          </label>

          {!hasTouch && (
            <label className="mt-1.5 flex items-center justify-between text-sm cursor-pointer">
              <span>Confirm clear</span>
              <input
                type="checkbox"
                checked={settings.confirmClear}
                onChange={(e) =>
                  updateSettings({ confirmClear: e.target.checked })
                }
                className={
                  settings.showZoomControls
                    ? "accent-blue-500"
                    : isDark
                      ? "accent-white/70"
                      : "accent-black/70"
                }
              />
            </label>
          )}

          <div className="mt-3 text-sm">Theme</div>
          <div className="flex gap-1 mt-1.5">
            {(["dark", "midnight", "white"] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateSettings({ theme: t })}
                className={`flex-1 py-1 rounded text-xs transition-colors ${
                  settings.theme === t
                    ? isDark
                      ? "bg-white/20 text-white"
                      : "bg-black/20 text-black"
                    : isDark
                      ? "bg-white/5 text-white/60 hover:bg-white/10"
                      : "bg-black/5 text-black/60 hover:bg-black/10"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              updateSettings({
                lineWidth: 5,
                lineColor: defaultLineColor,
                dashGap: 5,
              })
            }
            className={`mt-3 w-full py-1.5 rounded text-xs transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
          >
            Reset defaults
          </button>

          {!hasTouch && (
            <>
              <button
                onClick={() => setShowInfo((v) => !v)}
                className={`mt-3 flex items-center gap-1.5 text-xs transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}
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
                  className={`mt-2 pt-2 border-t ${isDark ? "border-white/10" : "border-black/10"}`}
                >
                  <div
                    className={`text-xs space-y-1 ${isDark ? "text-white/60" : "text-black/60"}`}
                  >
                    <div className="flex justify-between gap-4">
                      <span>Pan</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Click + drag / Arrows
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Zoom</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Pinch / {mod} + scroll
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Draw</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + drag
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Draw dashed</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Shift + drag
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Straight line</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + Shift + drag
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Erase</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {alt} + drag
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Draw shape</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {isMac ? "Ctrl" : `${alt} + Shift`} + drag
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Cycle shape</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        S
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Undo</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + Z
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Redo</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + Shift + Z
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Next color</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        ]
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Prev color</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        [
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Thicker</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Ctrl + +
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Thinner</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Ctrl + -
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Clear</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + K
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Reset zoom</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + 0
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Fit to content</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        {mod} + 1
                      </kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Menu</span>
                      <kbd
                        className={isDark ? "text-white/40" : "text-black/40"}
                      >
                        Ctrl + O
                      </kbd>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            onClick={() => setShowAbout((v) => !v)}
            className={`mt-3 flex items-center gap-1.5 text-xs transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}
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
              className={`mt-2 pt-2 border-t text-xs leading-relaxed ${isDark ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}
            >
              <p>simpledraw was built out of a need for three things:</p>
              <ul className="mt-1.5 list-disc list-inside space-y-1">
                <li>
                  A classic freehand whiteboard &mdash; simple to draw on, no
                  bloat.
                </li>
                <li>
                  A keyboard-first experience. Drawing by clicking and dragging
                  (especially on a trackpad) is painful, so every action is a
                  modifier key away.
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
        </div>
      )}
    </div>
  );
}
