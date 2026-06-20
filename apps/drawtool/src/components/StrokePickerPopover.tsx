import { useEffect } from "react";
import type { Stroke } from "../canvas/types";
import { getPanelBackground } from "../canvas/rendering";
import type { Theme } from "../hooks/useSettings";

function strokeLabel(s: Stroke): string {
  if (s.text) {
    const t = s.text.replace(/\n/g, " ").trim();
    return `"${t.slice(0, 22)}${t.length > 22 ? "…" : ""}"`;
  }
  if (s.imageId) return "Image";
  if (s.subStrokes?.length) return "Group";
  if (s.shape === "line") return "Line";
  if (s.shape === "arrow") return "Arrow";
  if (s.shape) return s.shape.charAt(0).toUpperCase() + s.shape.slice(1);
  if (s.highlight) return "Highlight";
  if (s.spray) return "Spray";
  return "Stroke";
}

export default function StrokePickerPopover({
  x,
  y,
  strokes,
  isDark,
  theme,
  customThemeBg,
}: {
  x: number;
  y: number;
  strokes: Stroke[];
  isDark: boolean;
  theme: Theme;
  customThemeBg?: string;
}) {
  const bg = getPanelBackground(theme, customThemeBg);
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.dispatchEvent(new CustomEvent("drawtool:stroke-picker-close"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Topmost stroke first
  const list = [...strokes].reverse();

  const popW = 188;
  const rowH = 36;
  const popH = list.length * rowH + 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const left = x + popW + 8 > vw ? x - popW - 4 : x + 4;
  const top = y + popH + 8 > vh ? y - popH - 4 : y + 4;

  return (
    <>
      <div
        className="fixed inset-0 z-[59]"
        onPointerDown={() =>
          window.dispatchEvent(new CustomEvent("drawtool:stroke-picker-close"))
        }
      />
      <div
        className="fixed z-[60] py-1.5 px-1"
        style={{
          left,
          top,
          width: popW,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: "blur(14px)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          userSelect: "none",
        }}
      >
        {list.map((stroke, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
              isDark
                ? "hover:bg-white/10 text-white/85"
                : "hover:bg-black/[0.06] text-black/75"
            }`}
            style={{ height: rowH }}
            onMouseEnter={() =>
              window.dispatchEvent(
                new CustomEvent("drawtool:stroke-picker-hover", {
                  detail: stroke,
                })
              )
            }
            onMouseLeave={() =>
              window.dispatchEvent(
                new CustomEvent("drawtool:stroke-picker-hover", {
                  detail: null,
                })
              )
            }
            onPointerDown={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("drawtool:stroke-picker-select", {
                  detail: stroke,
                })
              );
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: stroke.color,
                flexShrink: 0,
                border: `1px solid ${
                  isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)"
                }`,
              }}
            />
            <span className="truncate leading-tight">{strokeLabel(stroke)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
