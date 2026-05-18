import { useState, useRef, useEffect } from "react";
import type { BankItem } from "../canvas/types";
import { renderStrokesToCtx, anyStrokeBBox } from "../canvas/canvasUtils";
import type { Theme } from "../hooks/useSettings";

function BankItemThumbnail({ item }: { item: BankItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    renderedRef.current = false;
  }, [item]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const render = () => {
      if (renderedRef.current) return;
      if (item.strokes.length === 0) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      renderedRef.current = true;

      const SIZE = 100;
      const dpr = window.devicePixelRatio || 1;
      el.width = SIZE * dpr;
      el.height = SIZE * dpr;
      el.style.width = SIZE + "px";
      el.style.height = SIZE + "px";
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, SIZE, SIZE);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of item.strokes) {
        const bb = anyStrokeBBox(s);
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);

      const PAD = 10;
      const scale = Math.min((SIZE - PAD * 2) / bw, (SIZE - PAD * 2) / bh);
      const tx = PAD + (SIZE - PAD * 2 - bw * scale) / 2 - minX * scale;
      const ty = PAD + (SIZE - PAD * 2 - bh * scale) / 2 - minY * scale;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      renderStrokesToCtx(ctx, item.strokes);
      ctx.restore();
    };

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) render(); },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [item]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: 100, height: 100 }}
    />
  );
}

function panelBackground(theme: Theme): string {
  if (theme === "midnight") return "rgba(15,15,30,0.92)";
  if (theme === "lumber")   return "rgba(10,10,2,0.92)";
  if (theme === "slate")    return "rgba(18,22,28,0.92)";
  if (theme === "dark")     return "rgba(10,10,10,0.92)";
  if (theme === "journal")  return "rgba(255,252,224,0.92)";
  if (theme === "sky")      return "rgba(234,244,251,0.92)";
  if (theme === "sand")     return "rgba(245,237,232,0.92)";
  return "rgba(255,255,255,0.92)"; // white
}

export default function BankPanel({
  items,
  isDark,
  theme,
  hasTouch,
  onClose,
  onDrop,
  onDelete,
  onRename,
  onReorder,
  onImport,
}: {
  items: BankItem[];
  isDark: boolean;
  theme: Theme;
  hasTouch: boolean;
  onClose: () => void;
  onDrop: (item: BankItem) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onImport: (items: BankItem[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!showHeaderMenu) return;
    const onPointer = (e: PointerEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node))
        setShowHeaderMenu(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [showHeaderMenu]);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const commitRename = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  const handleExport = () => {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawtool-bank.json";
    a.click();
    URL.revokeObjectURL(url);
    setShowHeaderMenu(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const imported: BankItem[] = Array.isArray(parsed) ? parsed : [];
        if (imported.length) onImport(imported);
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = "";
    setShowHeaderMenu(false);
  };

  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const canDrag = !search;

  const titleLetters = [
    { letter: "b", color: "#3b82f6", rotate: -4 },
    { letter: "a", color: "#ec4899", rotate: 3 },
    { letter: "n", color: "#22c55e", rotate: -3 },
    { letter: "k", color: "#f97316", rotate: 4 },
  ];

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col shadow-2xl"
      style={{
        width: 300,
        background: panelBackground(theme),
        borderLeft: `1px solid ${border}`,
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1 px-4 py-3"
      >
        <div className="flex-1 select-none" style={{ fontFamily: "Pacifico, cursive", fontSize: 17 }}>
          {titleLetters.map((l, i) => (
            <span key={i} style={{ display: "inline-block", marginLeft: i === 0 ? 0 : 1, transform: `rotate(${l.rotate}deg)` }}>
              <span style={{ color: l.color, display: "inline-block", textShadow: isDark ? `0 0 8px ${l.color}44` : `1px 1px 0 ${l.color}22` }}>
                {l.letter}
              </span>
            </span>
          ))}
        </div>

        {/* Import/export dropdown */}
        <div className="relative" ref={headerMenuRef}>
          <button
            aria-label="Bank options"
            onClick={() => setShowHeaderMenu((p) => !p)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
            </svg>
          </button>
          {showHeaderMenu && (
            <div
              className="absolute right-0 top-8 z-10 rounded-xl overflow-hidden shadow-lg py-1"
              style={{
                minWidth: 148,
                background: isDark ? "rgba(20,20,20,0.98)" : "rgba(255,255,255,0.98)",
                border: `1px solid ${border}`,
              }}
            >
              {[
                { label: "Export bank", icon: <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v8M4 6l3 3 3-3M1 10v1.5A1.5 1.5 0 0 0 2.5 13h9A1.5 1.5 0 0 0 13 11.5V10"/></svg>, action: handleExport },
                { label: "Import bank", icon: <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9V1M4 4l3-3 3 3M1 10v1.5A1.5 1.5 0 0 0 2.5 13h9A1.5 1.5 0 0 0 13 11.5V10"/></svg>, action: () => importRef.current?.click() },
              ].map(({ label, icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                  style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          aria-label="Close bank"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2.5 pb-2 relative">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
          style={{
            background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${border}`,
            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
          }}
        />
        {!search && !hasTouch && (
          <kbd
            className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[10px] px-1 py-px rounded"
            style={{
              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${border}`,
              color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
            }}
          >
            /
          </kbd>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 && (
          <div
            className="text-xs text-center py-10"
            style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)" }}
          >
            {items.length === 0 ? (
              <>
                <div className="mb-1">No items saved yet</div>
                {!hasTouch && (
                  <div style={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)" }}>
                    ⌘⇧K to save selection
                  </div>
                )}
              </>
            ) : (
              "No matches"
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-xl overflow-hidden"
              draggable={canDrag}
              onDragStart={(e) => {
                setDragId(item.id);
                e.dataTransfer.setData("drawtool/bank-item", JSON.stringify({ strokes: item.strokes, savedDark: item.savedDark }));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== item.id) onReorder(dragId, item.id);
                setDragId(null); setDragOverId(null);
              }}
              style={{
                border: dragOverId === item.id
                  ? `1px solid ${isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.30)"}`
                  : `1px solid ${cardBorder}`,
                opacity: dragId === item.id ? 0.4 : 1,
                transition: "border-color 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                if (dragOverId === item.id) return;
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(0,0,0,0.20)";
              }}
              onMouseLeave={(e) => {
                if (dragOverId === item.id) return;
                (e.currentTarget as HTMLElement).style.borderColor = cardBorder;
              }}
            >
              {/* Thumbnail — click to drop */}
              <div
                className="flex items-center justify-center cursor-pointer"
                style={{
                  width: "100%",
                  height: 108,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                }}
                onClick={() => onDrop(item)}
              >
                <BankItemThumbnail item={item} />
              </div>

              {/* Name row — click to rename, delete on hover */}
              <div
                className="flex items-center gap-1 px-2 py-1.5"
                style={{ borderTop: `1px solid ${cardBorder}` }}
              >
                {editingId === item.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-xs bg-transparent border-none outline-none min-w-0"
                    style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)" }}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitRename(item.id)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") { e.preventDefault(); commitRename(item.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="flex-1 text-xs truncate min-w-0 cursor-text"
                    style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)" }}
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                )}

                <button
                  aria-label={`Delete ${item.name}`}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                  style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}
                  onClick={() => onDelete(item.id)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#ec4899";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.25)";
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
                    <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
    </div>
  );
}
