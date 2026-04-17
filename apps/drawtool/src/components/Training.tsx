import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Settings } from "../hooks/useSettings";
import { CHALLENGES, loadProgress, saveProgress } from "../training/challenges";
import type { StrokeSnapshot } from "../training/challenges";

type Props = {
  settings: Settings;
  isDark: boolean;
  hasTouch: boolean;
  onExit: () => void;
};

export default function Training({
  settings,
  isDark,
  hasTouch,
  onExit,
}: Props) {
  const [completed, setCompleted] = useState<Set<string>>(() => loadProgress());
  const [currentId, setCurrentId] = useState<string>(() => {
    const prog = loadProgress();
    const first = CHALLENGES.find((c) => !prog.has(c.id));
    return first?.id ?? CHALLENGES[0].id;
  });
  const [hintOpen, setHintOpen] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(false);
  const [listView, setListView] = useState(false);

  // Sync ref so event handlers always see current completed set
  const completedRef = useRef(completed);
  completedRef.current = completed;

  // Track previous settings values for settings-changed validation
  const prevSettingsRef = useRef(settings);

  // Sorted: completed challenges first (in original order), then incomplete
  const sortedChallenges = useMemo(() => {
    const done = CHALLENGES.filter((c) => completed.has(c.id));
    const todo = CHALLENGES.filter((c) => !completed.has(c.id));
    return [...done, ...todo];
  }, [completed]);

  const currentIdx = sortedChallenges.findIndex((c) => c.id === currentId);
  const challenge = sortedChallenges[currentIdx] ?? sortedChallenges[0];
  const totalCompleted = completed.size;
  const allDone = totalCompleted >= CHALLENGES.length;
  const isAlreadyDone = completed.has(challenge.id);

  // Reset individual hint when challenge changes
  useEffect(() => {
    setHintOpen(false);
  }, [currentId]);

  // Core: mark any challenge as complete (idempotent)
  const completeChallenge = useCallback((id: string, title: string) => {
    if (completedRef.current.has(id)) return;
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveProgress(next);
      return next;
    });
    // Toast via app's existing toast system
    window.dispatchEvent(
      new CustomEvent("drawtool:toast", {
        detail: { message: title, duration: 2200, challenge: true },
      }),
    );
    // Advance to next incomplete challenge if this was the current one
    setCurrentId((curId) => {
      if (curId !== id) return curId;
      const nextIncomplete = CHALLENGES.find(
        (c) => !completedRef.current.has(c.id) && c.id !== id,
      );
      return nextIncomplete?.id ?? id;
    });
  }, []);

  // Manual complete for current challenge
  const markCurrentComplete = useCallback(() => {
    completeChallenge(challenge.id, challenge.title);
  }, [challenge, completeChallenge]);

  // Stroke-committed: check ALL incomplete stroke challenges
  useEffect(() => {
    const handler = (e: Event) => {
      const snap = (e as CustomEvent).detail as StrokeSnapshot;
      for (const c of CHALLENGES) {
        if (c.validation.type !== "stroke") continue;
        if (completedRef.current.has(c.id)) continue;
        if (c.validation.predicate(snap)) {
          completeChallenge(c.id, c.title);
        }
      }
    };
    window.addEventListener("drawtool:stroke-committed", handler);
    return () =>
      window.removeEventListener("drawtool:stroke-committed", handler);
  }, [completeChallenge]);

  // Settings-changed: check ALL incomplete settings-changed challenges on each settings update
  useEffect(() => {
    const prev = prevSettingsRef.current;
    for (const c of CHALLENGES) {
      if (c.validation.type !== "settings-changed") continue;
      if (completedRef.current.has(c.id)) continue;
      const key = c.validation.key;
      if (prev[key] !== settings[key]) {
        completeChallenge(c.id, c.title);
      }
    }
    prevSettingsRef.current = settings;
  }, [settings, completeChallenge]);

  // Canvas-changed: check ALL canvas-changed challenges
  useEffect(() => {
    const handler = (e: Event) => {
      const n = (e as CustomEvent).detail as number;
      for (const c of CHALLENGES) {
        if (c.validation.type !== "canvas-changed") continue;
        if (completedRef.current.has(c.id)) continue;
        if (c.validation.toIndex === n) {
          completeChallenge(c.id, c.title);
        }
      }
    };
    window.addEventListener("drawtool:switch-canvas", handler);
    return () => window.removeEventListener("drawtool:switch-canvas", handler);
  }, [completeChallenge]);

  // Erase: check ALL erase challenges
  useEffect(() => {
    const handler = () => {
      for (const c of CHALLENGES) {
        if (c.validation.type !== "erase") continue;
        if (completedRef.current.has(c.id)) continue;
        completeChallenge(c.id, c.title);
      }
    };
    window.addEventListener("drawtool:stroke-erased", handler);
    return () => window.removeEventListener("drawtool:stroke-erased", handler);
  }, [completeChallenge]);

  // Clear: check ALL clear challenges
  useEffect(() => {
    const handler = () => {
      for (const c of CHALLENGES) {
        if (c.validation.type !== "clear") continue;
        if (completedRef.current.has(c.id)) continue;
        completeChallenge(c.id, c.title);
      }
    };
    window.addEventListener("drawtool:clear", handler);
    return () => window.removeEventListener("drawtool:clear", handler);
  }, [completeChallenge]);

  // Generic events (e.g. drawtool:did-undo): collect unique event names
  useEffect(() => {
    const eventNames = new Set<string>();
    for (const c of CHALLENGES) {
      if (c.validation.type === "event") eventNames.add(c.validation.name);
    }
    const handlers = new Map<string, () => void>();
    for (const name of eventNames) {
      const handler = () => {
        for (const c of CHALLENGES) {
          if (c.validation.type !== "event" || c.validation.name !== name)
            continue;
          if (completedRef.current.has(c.id)) continue;
          completeChallenge(c.id, c.title);
        }
      };
      handlers.set(name, handler);
      window.addEventListener(name, handler);
    }
    return () => {
      for (const [name, handler] of handlers) {
        window.removeEventListener(name, handler);
      }
    };
  }, [completeChallenge]);

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";
  const shapeModifier = isMac ? "Ctrl" : "Alt+⇧";
  const resolveHint = (hint: string) =>
    hint
      .replace(/\{mod\}/g, mod)
      .replace(/\{alt\}/g, alt)
      .replace(/\{shift\}/g, "⇧")
      .replace(/\{ctrl\}/g, shapeModifier);

  // Tokenise: color swatches + keyboard keys
  const TOKEN =
    /(\(?#[0-9a-fA-F]{6}\)?|⌘|⌥|⇧|\bCtrl\b|\bAlt\b|\bSpace\b|\bEscape\b|\[|\]|\b[A-Z]\b|\b\d\b)/g;
  const isKey = (s: string) =>
    /^(⌘|⌥|⇧|Ctrl|Alt|Space|Escape|\[|\]|[A-Z]|\d)$/.test(s);
  const kbdStyle = isDark
    ? "inline-block px-1 py-px rounded text-[10px] font-mono leading-none bg-white/15 text-white/80 border border-white/20"
    : "inline-block px-1 py-px rounded text-[10px] font-mono leading-none bg-black/8 text-black/70 border border-black/15";

  const renderText = (text: string) => {
    const parts = text.split(TOKEN);
    return parts.map((part, i) => {
      const hex = part.match(/^\(?#([0-9a-fA-F]{6})\)?$/)?.[1];
      if (hex) {
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <span
              className="inline-block rounded-full shrink-0"
              style={{
                width: 10,
                height: 10,
                background: `#${hex}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
              }}
            />
          </span>
        );
      }
      if (isKey(part)) {
        return (
          <kbd key={i} className={kbdStyle}>
            {part}
          </kbd>
        );
      }
      return part;
    });
  };

  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const divider = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const textPrimary = isDark ? "text-white/90" : "text-black/85";
  const textMuted = isDark ? "text-white/50" : "text-black/45";
  const textFaint = isDark ? "text-white/25" : "text-black/25";

  return (
    <>
      <div
        className={`fixed ${hasTouch ? "bottom-24" : "bottom-4"} right-4 z-30 w-72 rounded-xl border backdrop-blur-md shadow-lg overflow-hidden`}
        style={{
          background: isDark ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.92)",
          borderColor: border,
        }}
      >
        {/* Progress bar */}
        <div
          className="h-0.5"
          style={{
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
          }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.round((totalCompleted / CHALLENGES.length) * 100)}%`,
              background: "linear-gradient(90deg, #3b82f6, #ec4899)",
            }}
          />
        </div>

        <div className="p-4">
          {/* Shared header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono tabular-nums">
              <span style={{ color: "#3b82f6" }}>{totalCompleted}</span>
              <span className={textFaint}> / {CHALLENGES.length}</span>
            </span>
            <div className="flex items-center gap-1.5">
              {/* Global hints toggle */}
              <button
                onClick={() => {
                  if (hintsRevealed) {
                    setHintsRevealed(false);
                    setHintOpen(false);
                  } else {
                    setHintsRevealed(true);
                  }
                }}
                title={hintsRevealed ? "Hide all hints" : "Show all hints"}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors"
                style={hintsRevealed ? {
                  background: "rgba(59,130,246,0.15)",
                  color: "#3b82f6",
                } : {
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                  color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
                  <circle cx="8" cy="8" r="1.75" />
                  {!hintsRevealed && <line x1="3" y1="3" x2="13" y2="13" />}
                </svg>
                Hints
              </button>
              <button
                onClick={() => setListView((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors"
                style={listView ? {
                  background: "rgba(236,72,153,0.15)",
                  color: "#ec4899",
                } : {
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                  color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {listView ? (
                    <>
                      <path d="M4 8h8" />
                      <path d="M4 4l2 4-2 4" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="5" x2="13" y2="5" />
                      <line x1="3" y1="8" x2="13" y2="8" />
                      <line x1="3" y1="11" x2="13" y2="11" />
                    </>
                  )}
                </svg>
                {listView ? "Current" : "All"}
              </button>
            </div>
          </div>

          {listView ? (
            /* List view */
            <>
              <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
                {CHALLENGES.map((c) => {
                  const done = completed.has(c.id);
                  const isCurrent = c.id === currentId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCurrentId(c.id);
                        setListView(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left transition-colors ${
                        isCurrent
                          ? isDark
                            ? "bg-white/10"
                            : "bg-black/8"
                          : isDark
                            ? "hover:bg-white/6"
                            : "hover:bg-black/5"
                      }`}
                    >
                      <span
                        className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                        style={{
                          background: done
                            ? "#22c55e"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.08)",
                          color: done ? "#fff" : "transparent",
                        }}
                      >
                        ✓
                      </span>
                      <span
                        className={`text-xs leading-snug ${
                          done
                            ? isDark
                              ? "text-white/40"
                              : "text-black/35"
                            : isCurrent
                              ? isDark
                                ? "text-white/90"
                                : "text-black/85"
                              : isDark
                                ? "text-white/60"
                                : "text-black/55"
                        }`}
                      >
                        {c.title}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className="mt-3 pt-3"
                style={{ borderTop: `1px solid ${divider}` }}
              >
                <button
                  onClick={onExit}
                  className="text-xs w-full text-center transition-colors"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.22)"
                      : "rgba(0,0,0,0.22)",
                  }}
                >
                  Exit Training
                </button>
              </div>
            </>
          ) : (
            /* Challenge view */
            <>
              {allDone && (
                <div
                  className={`text-xs text-center mb-3 pb-3 ${textMuted}`}
                  style={{ borderBottom: `1px solid ${divider}` }}
                >
                  All {CHALLENGES.length} challenges complete 🎉
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <div className={`text-sm font-semibold ${textPrimary}`}>
                    {challenge.title}
                  </div>
                  <span
                    className={`text-[11px] font-mono tabular-nums shrink-0 ${textFaint}`}
                  >
                    #{currentIdx + 1}
                  </span>
                </div>
                {isAlreadyDone && (
                  <span
                    className="text-[10px] font-medium shrink-0 ml-2 px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                  >
                    ✓ done
                  </span>
                )}
              </div>

              {/* Description */}
              <div className={`text-xs leading-relaxed mb-2 ${textMuted}`}>
                {renderText(challenge.description)}
              </div>

              {/* Hint — always visible, blurred until revealed */}
              <div className="relative mb-4">
                <div
                  className={`text-[11px] leading-relaxed pl-3 pr-5 transition-all duration-200 select-none ${
                    isDark ? "text-white/45" : "text-black/40"
                  } ${hintOpen || hintsRevealed ? "" : "blur-[4px] pointer-events-none"}`}
                  style={{
                    borderLeft: "2px solid rgba(59,130,246,0.3)",
                  }}
                >
                  {renderText(
                    resolveHint(
                      hasTouch ? challenge.hint.mobile : challenge.hint.desktop,
                    ),
                  )}
                </div>
                {!hintsRevealed && (
                  <button
                    onClick={() => setHintOpen((o) => !o)}
                    title={hintOpen ? "Hide solution" : "Show solution"}
                    className={`absolute top-0 right-0 transition-opacity ${
                      hintOpen
                        ? isDark
                          ? "opacity-30 hover:opacity-60"
                          : "opacity-25 hover:opacity-50"
                        : isDark
                          ? "opacity-40 hover:opacity-70"
                          : "opacity-35 hover:opacity-65"
                    }`}
                  >
                    {hintOpen ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
                        <circle cx="8" cy="8" r="1.75" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
                        <circle cx="8" cy="8" r="1.75" />
                        <line x1="3" y1="3" x2="13" y2="13" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* Manual complete button */}
              {challenge.validation.type === "manual" && !isAlreadyDone && (
                <button
                  onClick={markCurrentComplete}
                  className={`w-full py-1.5 rounded text-xs font-medium transition-colors mb-3 ${
                    isDark
                      ? "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
                      : "bg-black/10 text-black/60 hover:bg-black/15 hover:text-black"
                  }`}
                >
                  Mark complete
                </button>
              )}

              {/* Prev / Next/Skip nav */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setCurrentId(
                      sortedChallenges[Math.max(0, currentIdx - 1)].id,
                    )
                  }
                  disabled={currentIdx === 0}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    currentIdx === 0
                      ? `${textFaint} cursor-default`
                      : isDark
                        ? "text-white/55 hover:text-white/85 bg-white/0 hover:bg-white/8"
                        : "text-black/45 hover:text-black/80 bg-black/0 hover:bg-black/6"
                  }`}
                >
                  ← Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentId(
                      sortedChallenges[
                        Math.min(currentIdx + 1, sortedChallenges.length - 1)
                      ].id,
                    )
                  }
                  disabled={currentIdx === sortedChallenges.length - 1}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    currentIdx === sortedChallenges.length - 1
                      ? `${textFaint} cursor-default`
                      : "text-[#ec4899] hover:bg-[#ec4899]/10"
                  }`}
                >
                  {isAlreadyDone ? "Next →" : "Skip →"}
                </button>
              </div>

              {/* Exit */}
              <div
                className="mt-3 pt-3"
                style={{ borderTop: `1px solid ${divider}` }}
              >
                <button
                  onClick={onExit}
                  className="text-xs w-full text-center transition-colors"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.22)"
                      : "rgba(0,0,0,0.22)",
                  }}
                >
                  Exit Training
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
