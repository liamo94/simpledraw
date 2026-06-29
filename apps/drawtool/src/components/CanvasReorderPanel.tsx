import { useState, useRef, useEffect } from "react";
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

type CloudCanvasItem = { id: string; name: string; position: number; is_empty?: number; stroke_count?: number };

type Props = {
  activeCanvas: number;
  isDark: boolean;
  theme: Theme;
  customBg?: string;
  onReorderCanvases: (newOrder: number[]) => void;
  onSwitchCanvas: (n: number) => void;
  onClose: () => void;
  // Cloud mode: when provided, shows cloud canvases instead of local slots
  cloudCanvases?: CloudCanvasItem[];
  activeCloudCanvasId?: string | null;
  onReorderCloud?: (ids: string[]) => Promise<boolean>;
};

export default function CanvasReorderPanel({ activeCanvas, isDark, theme, customBg, onReorderCanvases, onSwitchCanvas, onClose, cloudCanvases, activeCloudCanvasId, onReorderCloud }: Props) {
  const isCloud = !!cloudCanvases;

  const [localInfos, setLocalInfos] = useState<CanvasInfo[]>(() =>
    Array.from({ length: 9 }, (_, i) => readCanvasInfo(i + 1))
  );
  const [cloudOrder, setCloudOrder] = useState<CloudCanvasItem[]>(
    () => cloudCanvases ? [...cloudCanvases].sort((a, b) => a.position - b.position) : []
  );
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const didDragRef = useRef(false);

  const itemCount = isCloud ? cloudOrder.length : 9;
  const initialFocus = isCloud
    ? Math.max(0, cloudOrder.findIndex(c => c.id === activeCloudCanvasId))
    : activeCanvas - 1;
  const [focusedIndex, setFocusedIndex] = useState(initialFocus);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, itemCount - 1);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (isCloud) {
          const canvas = cloudOrder[focusedIndex];
          if (canvas && canvas.id !== activeCloudCanvasId) {
            onSwitchCanvas(focusedIndex + 1);
          }
        } else {
          const pos = focusedIndex + 1;
          if (pos !== activeCanvas) onSwitchCanvas(pos);
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [focusedIndex, itemCount, isCloud, cloudOrder, activeCloudCanvasId, activeCanvas, onSwitchCanvas, onClose]);

  const infos = localInfos;
  const refreshInfos = () => {
    setLocalInfos(Array.from({ length: 9 }, (_, i) => readCanvasInfo(i + 1)));
  };

  const DragHandle = () => (
    <svg width="10" height="14" viewBox="0 0 10 14" className={`shrink-0 ${isDark ? "text-white/25" : "text-black/20"}`} fill="currentColor">
      <circle cx="3" cy="2.5" r="1.2" /><circle cx="7" cy="2.5" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="11.5" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
    </svg>
  );

  const rowCls = (isActive: boolean, isOver: boolean, isFocused: boolean) =>
    `flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none transition-colors ${
      isOver
        ? isDark ? "bg-white/12 ring-1 ring-white/20" : "bg-black/[0.08] ring-1 ring-black/15"
        : isFocused
          ? isDark ? "bg-white/[0.08] ring-1 ring-white/25" : "bg-black/[0.06] ring-1 ring-black/20"
          : isActive
            ? isDark ? "bg-[#3b82f6]/15" : "bg-[#3b82f6]/[0.08]"
            : isDark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.03]"
    }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 rounded-xl border w-[min(380px,calc(100vw-2rem))] flex flex-col max-h-[90vh] ${
          isDark ? "border-white/15" : "border-black/15"
        }`}
        style={{ background: getPanelBackground(theme, customBg) }}
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
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-2 pt-1 pb-2">
          {isCloud ? (
            // ── Cloud mode ────────────────────────────────────────────────
            cloudOrder.map((canvas, i) => {
              const isActive = canvas.id === activeCloudCanvasId;
              const isOver = dragOver === i;
              const isFocused = focusedIndex === i;
              const displayName = canvas.name || `Canvas ${i + 1}`;
              const isEmpty = canvas.is_empty === 1;
              const strokeCount = !isEmpty && (canvas.stroke_count ?? 0) > 0 ? (canvas.stroke_count ?? 0) : null;
              return (
                <div
                  key={canvas.id}
                  ref={el => { rowRefs.current[i] = el; }}
                  draggable
                  onDragStart={(e) => { dragFrom.current = i; didDragRef.current = false; e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== i) setDragOver(i); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragFrom.current;
                    dragFrom.current = null;
                    setDragOver(null);
                    if (from === null || from === i) return;
                    const next = [...cloudOrder];
                    const [removed] = next.splice(from, 1);
                    next.splice(i, 0, removed);
                    setCloudOrder(next);
                    onReorderCloud?.(next.map(c => c.id));
                  }}
                  onDragEnd={() => { dragFrom.current = null; setDragOver(null); didDragRef.current = true; setTimeout(() => { didDragRef.current = false; }, 200); }}
                  onClick={() => { if (didDragRef.current) return; setFocusedIndex(i); if (!isActive) { onSwitchCanvas(i + 1); onClose(); } }}
                  className={rowCls(isActive, isOver, isFocused)}
                >
                  <DragHandle />
                  <span className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                    isActive ? "bg-[#3b82f6] text-white" : isDark ? "bg-white/[0.08] text-white/40" : "bg-black/[0.06] text-black/35"
                  }`}>{i + 1}</span>
                  <span className={`flex-1 text-xs truncate min-w-0 ${
                    isEmpty ? isDark ? "text-white/20" : "text-black/[0.18]"
                    : isActive ? isDark ? "text-white/90" : "text-black/85"
                    : isDark ? "text-white/60" : "text-black/55"
                  }`}>{displayName}</span>
                  {strokeCount !== null && !isEmpty && (
                    <span className={`text-[10px] tabular-nums shrink-0 ${isDark ? "text-white/25" : "text-black/[0.22]"}`}>
                      {strokeCount} {strokeCount === 1 ? "stroke" : "strokes"}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            // ── Local mode ────────────────────────────────────────────────
            infos.map((info, i) => {
              const pos = i + 1;
              const isActive = pos === activeCanvas;
              const isEmpty = info.strokeCount === 0;
              const isOver = dragOver === i;
              const isFocused = focusedIndex === i;
              return (
                <div
                  key={i}
                  ref={el => { rowRefs.current[i] = el; }}
                  draggable
                  onClick={() => { if (didDragRef.current) return; setFocusedIndex(i); if (!isActive) { onSwitchCanvas(pos); onClose(); } }}
                  onDragStart={(e) => { dragFrom.current = i; didDragRef.current = false; e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== i) setDragOver(i); }}
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
                  onDragEnd={() => { dragFrom.current = null; setDragOver(null); didDragRef.current = true; setTimeout(() => { didDragRef.current = false; }, 200); }}
                  className={rowCls(isActive, isOver, isFocused)}
                >
                  <DragHandle />
                  <span className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                    isActive ? "bg-[#3b82f6] text-white" : isDark ? "bg-white/[0.08] text-white/40" : "bg-black/[0.06] text-black/35"
                  }`}>{pos}</span>
                  <span className={`flex-1 text-xs truncate min-w-0 ${
                    isEmpty ? isDark ? "text-white/20" : "text-black/[0.18]"
                    : isActive ? isDark ? "text-white/90" : "text-black/85"
                    : isDark ? "text-white/60" : "text-black/55"
                  }`}>{info.name || (isEmpty ? "Empty" : `Canvas ${pos}`)}</span>
                  {!isEmpty && (
                    <span className={`text-[10px] tabular-nums shrink-0 ${isDark ? "text-white/25" : "text-black/[0.22]"}`}>
                      {info.strokeCount} {info.strokeCount === 1 ? "stroke" : "strokes"}
                      {info.sizeKb >= 0.1 ? ` · ${info.sizeKb} KB` : ""}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
