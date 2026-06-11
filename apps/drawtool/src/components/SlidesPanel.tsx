import { useState, useRef, useEffect } from "react";
import type { Slide } from "../canvas/types";
import { getPanelBackground } from "../canvas/canvasUtils";
import type { Theme } from "../hooks/useSettings";

export default function SlidesPanel({
  slides,
  isDark,
  theme,
  customThemeBg,
  presentationShareEnabled,
  presentationShareToken,
  presentationShareHasPassword,
  onTogglePresentationShare,
  onSetPresentationSharePassword,
  showTips,
  hasTouch,
  onClose,
  onSlidesChange,
  onAddSlide,
  onNavigate,
  onPresent,
}: {
  slides: Slide[];
  isDark: boolean;
  theme: Theme;
  customThemeBg?: string;
  presentationShareEnabled?: boolean;
  presentationShareToken?: string;
  presentationShareHasPassword?: boolean;
  onTogglePresentationShare?: () => void;
  onSetPresentationSharePassword?: (
    password: string | null,
  ) => Promise<boolean>;
  showTips?: boolean;
  hasTouch?: boolean;
  onClose: () => void;
  onSlidesChange: (slides: Slide[]) => void;
  onAddSlide: () => void;
  onNavigate: (slide: Slide) => void;
  onPresent: (startIndex: number) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showPwRow, setShowPwRow] = useState(false);
  useEffect(() => {
    if (!presentationShareEnabled) {
      setShowPwRow(false);
      setPwInput("");
    }
  }, [presentationShareEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        e.shiftKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.ctrlKey &&
        slides.length > 0
      ) {
        e.preventDefault();
        onPresent(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length, onPresent]);

  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const placeholderBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  function commitRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed)
      onSlidesChange(
        slides.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
      );
    setEditingId(null);
  }

  function startRename(slide: Slide) {
    setEditingId(slide.id);
    setEditingName(slide.name);
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col shadow-2xl"
      style={{
        width: 280,
        background: getPanelBackground(theme, customThemeBg),
        borderLeft: `1px solid ${border}`,
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <span
          className="flex-1 select-none"
          style={{
            fontFamily: "Caveat Brush, cursive",
            fontSize: 18,
            color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
            letterSpacing: "0.02em",
          }}
        >
          Presentation
        </span>
        <button
          onClick={onAddSlide}
          className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors"
          style={{
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? "rgba(255,255,255,0.13)"
              : "rgba(0,0,0,0.10)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)";
          }}
        >
          + Add slide
        </button>
        <button
          aria-label="Close"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 10 10"
            fill="none"
            stroke="#ec4899"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>

      {/* Slide list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {slides.length === 0 ? (
          <div
            className="text-xs text-center py-10"
            style={{
              color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
            }}
          >
            <div className="mb-1">No slides yet</div>
            <div
              style={{
                color: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
              }}
            >
              Navigate to a spot and click + Add slide
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slides.map((slide, i) => {
              const isOver = dragOver === i;
              return (
                <div
                  key={slide.id}
                  draggable={editingId !== slide.id}
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
                    const next = [...slides];
                    const [removed] = next.splice(from, 1);
                    next.splice(i, 0, removed);
                    onSlidesChange(next);
                  }}
                  onDragEnd={() => {
                    dragFrom.current = null;
                    setDragOver(null);
                  }}
                  className="group relative rounded-xl cursor-grab active:cursor-grabbing"
                  style={{
                    background: isOver
                      ? isDark
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(0,0,0,0.07)"
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                    outline: "none",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-full overflow-hidden rounded-t-xl cursor-pointer"
                    style={{ aspectRatio: "16/9", background: placeholderBg }}
                    onClick={() => onNavigate(slide)}
                    onDoubleClick={() => onPresent(i)}
                  >
                    {slide.thumbnail ? (
                      <img
                        src={slide.thumbnail}
                        className="w-full h-full object-cover"
                        draggable={false}
                        style={{ display: "block" }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke={
                            isDark
                              ? "rgba(255,255,255,0.12)"
                              : "rgba(0,0,0,0.12)"
                          }
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="4" width="16" height="12" rx="2" />
                          <circle cx="7" cy="8.5" r="1.5" />
                          <polyline points="2 14 6 10 9 13 12 10 18 14" />
                        </svg>
                      </div>
                    )}
                    {/* Slide number badge */}
                    <span
                      className="absolute top-1.5 left-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-md font-medium"
                      style={{
                        background: "rgba(0,0,0,0.45)",
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  {/* Actions — outside thumbnail so tooltips can escape upward; hover-only on desktop */}
                  <div
                    className={`absolute top-1.5 right-1.5 z-10 flex gap-1 transition-opacity ${hasTouch ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <div className="relative group/play">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPresent(i);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md"
                        style={{
                          background: "rgba(0,0,0,0.55)",
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="currentColor"
                          stroke="none"
                        >
                          <polygon points="2,1 9,5 2,9" />
                        </svg>
                      </button>
                      {!hasTouch && (
                        <span
                          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/play:opacity-100 transition-opacity"
                          style={{
                            background: "rgba(0,0,0,0.75)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          Present from here
                        </span>
                      )}
                    </div>
                    <div className="relative group/del">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSlidesChange(
                            slides.filter((s) => s.id !== slide.id),
                          );
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                        style={{
                          background: "rgba(0,0,0,0.55)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "#f87171";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "rgba(255,255,255,0.7)";
                        }}
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
                          <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
                        </svg>
                      </button>
                      {!hasTouch && (
                        <span
                          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/del:opacity-100 transition-opacity"
                          style={{
                            background: "rgba(0,0,0,0.75)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          Delete
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name row */}
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-b-xl overflow-hidden">
                    {/* Drag handle — hidden on touch (no drag-to-reorder) */}
                    {!hasTouch && (
                      <svg
                        width="8"
                        height="10"
                        viewBox="0 0 8 10"
                        fill="currentColor"
                        className="shrink-0"
                        style={{
                          color: isDark
                            ? "rgba(255,255,255,0.18)"
                            : "rgba(0,0,0,0.18)",
                        }}
                      >
                        <rect x="0" y="1" width="3" height="2" rx="0.5" />
                        <rect x="5" y="1" width="3" height="2" rx="0.5" />
                        <rect x="0" y="4.5" width="3" height="2" rx="0.5" />
                        <rect x="5" y="4.5" width="3" height="2" rx="0.5" />
                        <rect x="0" y="8" width="3" height="2" rx="0.5" />
                        <rect x="5" y="8" width="3" height="2" rx="0.5" />
                      </svg>
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      {editingId === slide.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => commitRename(slide.id)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(slide.id);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-full text-[12px] bg-transparent outline-none border-b"
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(0,0,0,0.8)",
                            borderColor: isDark
                              ? "rgba(255,255,255,0.25)"
                              : "rgba(0,0,0,0.2)",
                          }}
                        />
                      ) : (
                        <span
                          className="text-[12px] truncate block"
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.75)"
                              : "rgba(0,0,0,0.7)",
                            cursor: hasTouch ? "pointer" : "text",
                          }}
                          onClick={
                            hasTouch ? () => startRename(slide) : undefined
                          }
                          onDoubleClick={
                            !hasTouch ? () => startRename(slide) : undefined
                          }
                        >
                          {slide.name}
                        </span>
                      )}
                    </div>

                    {/* Canvas label */}
                    <span
                      className="shrink-0 text-[10px]"
                      style={{
                        color: isDark
                          ? "rgba(255,255,255,0.25)"
                          : "rgba(0,0,0,0.25)",
                      }}
                    >
                      {slide.canvasName || `Canvas ${slide.canvasIndex}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — Present button */}
      {slides.length > 0 && (
        <div
          className="px-3 pb-4 pt-2 flex flex-col gap-2"
          style={{ borderTop: `1px solid ${border}` }}
        >
          {onTogglePresentationShare && (
            <div
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer select-none"
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(0,0,0,0.07)",
                color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
              }}
              onClick={onTogglePresentationShare}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = isDark
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(0,0,0,0.11)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isDark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(0,0,0,0.07)";
              }}
            >
              <span>Share</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/s/p/${presentationShareToken}`;
                    navigator.clipboard.writeText(url).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title="Copy link"
                  className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.6)"
                      : "rgba(0,0,0,0.55)",
                    visibility:
                      presentationShareEnabled && presentationShareToken
                        ? "visible"
                        : "hidden",
                    pointerEvents:
                      presentationShareEnabled && presentationShareToken
                        ? "auto"
                        : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.10)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  {copied ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 10 8 15 17 5" />
                    </svg>
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="8" y="2" width="10" height="13" rx="2" />
                      <path d="M4 6H3a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h9a1 1 0 0 0 1-1v-1" />
                    </svg>
                  )}
                </button>
                {onSetPresentationSharePassword && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPwRow((v) => !v);
                    }}
                    title="Password settings"
                    className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
                    style={{
                      visibility: presentationShareEnabled
                        ? "visible"
                        : "hidden",
                      pointerEvents: presentationShareEnabled ? "auto" : "none",
                      color: presentationShareHasPassword
                        ? isDark
                          ? "rgba(255,255,255,0.7)"
                          : "rgba(0,0,0,0.6)"
                        : isDark
                          ? "rgba(255,255,255,0.35)"
                          : "rgba(0,0,0,0.3)",
                      background: showPwRow
                        ? isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.09)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!showPwRow)
                        (e.currentTarget as HTMLElement).style.background =
                          isDark
                            ? "rgba(255,255,255,0.10)"
                            : "rgba(0,0,0,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!showPwRow)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="9" width="12" height="10" rx="2" />
                      <path d="M7 9V6a3 3 0 0 1 6 0v3" />
                    </svg>
                  </button>
                )}
                <span
                  className="w-8 h-4 rounded-full transition-colors relative shrink-0"
                  style={{
                    background: presentationShareEnabled
                      ? "#3b82f6"
                      : isDark
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(0,0,0,0.15)",
                  }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: presentationShareEnabled ? "17px" : "2px" }}
                  />
                </span>
              </div>
            </div>
          )}
          {presentationShareEnabled &&
            showPwRow &&
            onSetPresentationSharePassword && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke={
                    presentationShareHasPassword
                      ? isDark
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(0,0,0,0.5)"
                      : isDark
                        ? "rgba(255,255,255,0.25)"
                        : "rgba(0,0,0,0.22)"
                  }
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="4" y="9" width="12" height="10" rx="2" />
                  <path d="M7 9V6a3 3 0 0 1 6 0v3" />
                </svg>
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  onKeyDown={async (e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && pwInput && !pwSaving) {
                      setPwSaving(true);
                      await onSetPresentationSharePassword(pwInput);
                      setPwInput("");
                      setPwSaving(false);
                    }
                  }}
                  placeholder={
                    presentationShareHasPassword
                      ? "Change password…"
                      : "Add password…"
                  }
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(0,0,0,0.65)",
                    caretColor: isDark
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(0,0,0,0.65)",
                  }}
                />
                {pwInput ? (
                  <button
                    disabled={pwSaving}
                    onClick={async () => {
                      setPwSaving(true);
                      await onSetPresentationSharePassword(pwInput);
                      setPwInput("");
                      setPwSaving(false);
                    }}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(0,0,0,0.55)",
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 10 8 15 17 5" />
                    </svg>
                  </button>
                ) : presentationShareHasPassword ? (
                  <button
                    onClick={async () => {
                      setPwSaving(true);
                      await onSetPresentationSharePassword(null);
                      setPwSaving(false);
                    }}
                    title="Remove password"
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.28)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = isDark
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(0,0,0,0.55)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.28)";
                    }}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="1" y1="1" x2="9" y2="9" />
                      <line x1="9" y1="1" x2="1" y2="9" />
                    </svg>
                  </button>
                ) : null}
              </div>
            )}
          <button
            onClick={() => onPresent(0)}
            className="relative w-full py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.10)"
                : "rgba(0,0,0,0.07)",
              color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark
                ? "rgba(255,255,255,0.16)"
                : "rgba(0,0,0,0.11)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark
                ? "rgba(255,255,255,0.10)"
                : "rgba(0,0,0,0.07)";
            }}
          >
            ▶ Present
            {showTips && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-px rounded border"
                style={{
                  color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(0,0,0,0.10)",
                  background: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.04)",
                }}
              >
                ⇧ ↵
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
