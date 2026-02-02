import { useState, useRef, useEffect } from "react";
import type { Settings } from "../hooks/useSettings";

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  onExport: () => void;
  onExportTransparent: () => void;
  onClear: () => void;
  zoom: number;
  onResetView: () => void;
  resolvedTheme: "dark" | "light";
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
  resolvedTheme,
  hasTouch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const onToggle = () =>
      setOpen((o) => {
        if (o) setShowInfo(false);
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
      }
    };

    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInfo(false);
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
            if (o) setShowInfo(false);
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
          className={`mt-2 p-3 rounded-lg border backdrop-blur-sm min-w-45 overflow-y-auto max-h-[calc(100vh-5rem)] ${isDark ? "bg-black/70 border-white/15" : "bg-white/70 border-black/15"}`}
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

          <button
            onClick={onExport}
            className={`mt-3 w-full py-1.5 rounded text-xs transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
          >
            Export PNG
          </button>

          <button
            onClick={onExportTransparent}
            className={`mt-1.5 w-full py-1.5 rounded text-xs transition-colors ${isDark ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10" : "text-black/70 hover:text-black bg-black/5 hover:bg-black/10"}`}
          >
            Export transparent PNG
          </button>

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
              className={isDark ? "accent-white/70" : "accent-black/70"}
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
              className={isDark ? "accent-white/70" : "accent-black/70"}
            />
          </label>

          <label className="mt-1.5 flex items-center justify-between text-sm cursor-pointer">
            <span>Confirm clear</span>
            <input
              type="checkbox"
              checked={settings.confirmClear}
              onChange={(e) =>
                updateSettings({ confirmClear: e.target.checked })
              }
              className={isDark ? "accent-white/70" : "accent-black/70"}
            />
          </label>

          <div className="mt-3 text-sm">Theme</div>
          <div className="flex gap-1 mt-1.5">
            {(["system", "dark", "light"] as const).map((t) => (
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
                        Click + drag
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
