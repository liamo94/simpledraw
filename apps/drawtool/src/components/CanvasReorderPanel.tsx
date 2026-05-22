import { useState, useRef } from "react";
import { getPanelBackground } from "../canvas/canvasUtils";
import type { Theme } from "../hooks/useSettings";

type CanvasInfo = {
  name: string;
  strokeCount: number;
  sizeKb: number;
};

function readCanvasInfo(slot: number): CanvasInfo {
  const name = localStorage.getItem(`drawtool-canvas-name-${slot}`) ?? "";
  const raw = localStorage.getItem(`drawtool-strokes-${slot}`) ?? "";
  let strokeCount = 0;
  if (raw) {
    try { strokeCount = (JSON.parse(raw) as unknown[]).length; } catch {}
  }
  const sizeKb = raw ? Math.round(raw.length / 102.4) / 10 : 0;
  return { name, strokeCount, sizeKb };
}

type Props = {
  activeCanvas: number;
  isDark: boolean;
  theme: Theme;
  onReorderCanvases: (newOrder: number[]) => void;
  onClose: () => void;
};

export default function CanvasReorderPanel({ activeCanvas, isDark, theme, onReorderCanvases, onClose }: Props) {
  const [infos, setInfos] = useState<CanvasInfo[]>(() =>
    Array.from({ length: 9 }, (_, i) => readCanvasInfo(i + 1))
  );
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const refreshInfos = () => {
    setInfos(Array.from({ length: 9 }, (_, i) => readCanvasInfo(i + 1)));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 rounded-xl border w-[min(380px,calc(100vw-2rem))] flex flex-col max-h-[90vh] ${
          isDark ? "border-white/15" : "border-black/15"
        }`}
        style={{ background: getPanelBackground(theme) }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <span className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? "text-white/30" : "text-black/30"}`}>
            Canvases
          </span>
          <button
            onClick={onClose}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? "text-white/50 hover:text-white/80 hover:bg-white/10" : "text-black/40 hover:text-black/70 hover:bg-black/[0.07]"}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-2 pb-2">
          {infos.map((info, i) => {
            const pos = i + 1;
            const isActive = pos === activeCanvas;
            const isEmpty = info.strokeCount === 0;
            const isOver = dragOver === i;

            return (
              <div
                key={i}
                draggable
                onDragStart={(e) => {
                  dragFrom.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOver !== i) setDragOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  setDragOver(null);
                  if (from === null || from === i) return;
                  const order = Array.from({ length: 9 }, (_, j) => j + 1);
                  const [removed] = order.splice(from, 1);
                  order.splice(i, 0, removed);
                  onReorderCanvases(order);
                  refreshInfos();
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragOver(null);
                }}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none transition-colors ${
                  isOver
                    ? isDark ? "bg-white/12 ring-1 ring-white/20" : "bg-black/[0.08] ring-1 ring-black/15"
                    : isActive
                      ? isDark ? "bg-[#3b82f6]/15" : "bg-[#3b82f6]/[0.08]"
                      : isDark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.03]"
                }`}
              >
                {/* Drag handle */}
                <svg
                  width="10" height="14" viewBox="0 0 10 14"
                  className={`shrink-0 ${isDark ? "text-white/25" : "text-black/20"}`}
                  fill="currentColor"
                >
                  <circle cx="3" cy="2.5" r="1.2" />
                  <circle cx="7" cy="2.5" r="1.2" />
                  <circle cx="3" cy="7" r="1.2" />
                  <circle cx="7" cy="7" r="1.2" />
                  <circle cx="3" cy="11.5" r="1.2" />
                  <circle cx="7" cy="11.5" r="1.2" />
                </svg>

                {/* Position badge */}
                <span className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                  isActive
                    ? "bg-[#3b82f6] text-white"
                    : isDark ? "bg-white/[0.08] text-white/40" : "bg-black/[0.06] text-black/35"
                }`}>
                  {pos}
                </span>

                {/* Name */}
                <span className={`flex-1 text-xs truncate min-w-0 ${
                  isEmpty
                    ? isDark ? "text-white/20" : "text-black/[0.18]"
                    : isActive
                      ? isDark ? "text-white/90" : "text-black/85"
                      : isDark ? "text-white/60" : "text-black/55"
                }`}>
                  {info.name || (isEmpty ? "Empty" : `Canvas ${pos}`)}
                </span>

                {/* Stats */}
                {!isEmpty && (
                  <span className={`text-[10px] tabular-nums shrink-0 ${isDark ? "text-white/25" : "text-black/[0.22]"}`}>
                    {info.strokeCount} {info.strokeCount === 1 ? "stroke" : "strokes"}
                    {info.sizeKb >= 0.1 ? ` · ${info.sizeKb} KB` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
