import { memo, useState, useCallback } from "react";
import type React from "react";

type Action = { label: string; group: string; icon: React.ReactNode; action: () => void };

const kd = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

const COMMON_ACTIONS: Action[] = [
  {
    label: "Zoom to selection",
    group: "view",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="16" height="16" rx="1" strokeDasharray="2.5 2" />
        <path d="M8 11v4M8 11h4" strokeWidth="1.4" />
        <path d="M12 11l2.5 2.5" strokeWidth="1.2" />
      </svg>
    ),
    action: () => kd({ key: "4", shiftKey: true }),
  },
  {
    label: "To front",
    group: "layer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="12" height="8" rx="1.5" />
        <path d="M7.5 8 L10 5.5 L12.5 8" />
        <path d="M7.5 5 L10 2.5 L12.5 5" />
      </svg>
    ),
    action: () => kd({ key: "]", code: "BracketRight", metaKey: true }),
  },
  {
    label: "Bring forward",
    group: "layer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="12" height="8" rx="1.5" />
        <path d="M7.5 6.5 L10 4 L12.5 6.5" />
        <line x1="10" y1="4" x2="10" y2="9" />
      </svg>
    ),
    action: () => kd({ key: "]", code: "BracketRight", metaKey: true, altKey: true }),
  },
  {
    label: "Send backward",
    group: "layer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="12" height="8" rx="1.5" />
        <path d="M7.5 13.5 L10 16 L12.5 13.5" />
        <line x1="10" y1="16" x2="10" y2="11" />
      </svg>
    ),
    action: () => kd({ key: "[", code: "BracketLeft", metaKey: true, altKey: true }),
  },
  {
    label: "To back",
    group: "layer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="12" height="8" rx="1.5" />
        <path d="M7.5 12 L10 14.5 L12.5 12" />
        <path d="M7.5 15 L10 17.5 L12.5 15" />
      </svg>
    ),
    action: () => kd({ key: "[", code: "BracketLeft", metaKey: true }),
  },
  {
    label: "Copy",
    group: "edit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="10" height="13" rx="1.5" />
        <path d="M7 5V3.5A1.5 1.5 0 018.5 2h7A1.5 1.5 0 0117 3.5v11a1.5 1.5 0 01-1.5 1.5H14" strokeOpacity="0.45" />
      </svg>
    ),
    action: () => kd({ key: "c", metaKey: true }),
  },
  {
    label: "Cut",
    group: "edit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="15" r="2.5" />
        <circle cx="5" cy="5" r="2.5" />
        <path d="M7.5 13.5L16 4" />
        <path d="M7.5 6.5L16 16" />
      </svg>
    ),
    action: () => kd({ key: "x", metaKey: true }),
  },
  {
    label: "Duplicate",
    group: "edit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="10" height="13" rx="1.5" />
        <rect x="8" y="2" width="10" height="13" rx="1.5" strokeOpacity="0.4" />
      </svg>
    ),
    action: () => kd({ key: "d", metaKey: true }),
  },
  {
    label: "Save to bank",
    group: "edit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="6.5" />
        <circle cx="10" cy="10" r="2.3" />
        <line x1="11.6" y1="8.4" x2="14.1" y2="5.9" />
        <line x1="11.6" y1="11.6" x2="14.1" y2="14.1" />
        <line x1="8.4" y1="11.6" x2="5.9" y2="14.1" />
        <line x1="8.4" y1="8.4" x2="5.9" y2="5.9" />
      </svg>
    ),
    action: () => window.dispatchEvent(new Event("drawtool:save-to-bank")),
  },
];

const DRAWING_ACTIONS: Action[] = [
  {
    label: "Flip horizontal",
    group: "transform",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="3" x2="10" y2="17" />
        <path d="M7 6L3 10l4 4" />
        <path d="M13 6l4 4-4 4" strokeOpacity="0.4" />
      </svg>
    ),
    action: () => kd({ key: "h", metaKey: true, shiftKey: true }),
  },
  {
    label: "Flip vertical",
    group: "transform",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="10" x2="17" y2="10" />
        <path d="M6 7l4-4 4 4" />
        <path d="M6 13l4 4 4-4" strokeOpacity="0.4" />
      </svg>
    ),
    action: () => kd({ key: "v", metaKey: true, shiftKey: true }),
  },
];

const TEXT_ACTIONS: Action[] = [
  {
    label: "Bold",
    group: "format",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="none">
        <text x="10" y="15" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">B</text>
      </svg>
    ),
    action: () => kd({ key: "b", metaKey: true }),
  },
  {
    label: "Italic",
    group: "format",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="none">
        <text x="10" y="15" textAnchor="middle" fontSize="15" fontStyle="italic" fontFamily="Georgia,serif">I</text>
      </svg>
    ),
    action: () => kd({ key: "i", metaKey: true }),
  },
  {
    label: "Align left",
    group: "align",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="3" y1="5" x2="17" y2="5" />
        <line x1="3" y1="9" x2="13" y2="9" />
        <line x1="3" y1="13" x2="15" y2="13" />
        <line x1="3" y1="17" x2="11" y2="17" />
      </svg>
    ),
    action: () => kd({ key: "l", metaKey: true, shiftKey: true }),
  },
  {
    label: "Align center",
    group: "align",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="3" y1="5" x2="17" y2="5" />
        <line x1="5" y1="9" x2="15" y2="9" />
        <line x1="4" y1="13" x2="16" y2="13" />
        <line x1="6" y1="17" x2="14" y2="17" />
      </svg>
    ),
    action: () => kd({ key: "e", metaKey: true, shiftKey: true }),
  },
  {
    label: "Align right",
    group: "align",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="3" y1="5" x2="17" y2="5" />
        <line x1="7" y1="9" x2="17" y2="9" />
        <line x1="5" y1="13" x2="17" y2="13" />
        <line x1="9" y1="17" x2="17" y2="17" />
      </svg>
    ),
    action: () => kd({ key: "r", metaKey: true, shiftKey: true }),
  },
  {
    label: "Cycle text size",
    group: "text",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="none">
        <text x="6" y="15" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">A</text>
        <text x="15" y="15" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">A</text>
      </svg>
    ),
    action: () => kd({ key: "T", shiftKey: true }),
  },
  {
    label: "Cycle font",
    group: "text",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="none">
        <text x="6" y="15" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">A</text>
        <text x="15" y="15" textAnchor="middle" fontSize="13" fontFamily="Georgia,serif" fillOpacity="0.5">a</text>
      </svg>
    ),
    action: () => kd({ key: "Y", shiftKey: true }),
  },
];

const DANGER_ACTION: Action = {
  label: "Delete",
  group: "danger",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5.5h15" />
      <path d="M7.5 5.5V3.5h5v2" />
      <path d="M5 5.5l1 13h8l1-13" />
      <path d="M8.5 9v6M11.5 9v6" />
    </svg>
  ),
  action: () => kd({ key: "Backspace" }),
};

const COMBINE_ACTION: Action = {
  label: "Combine",
  group: "combine",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7L8 7" strokeOpacity="0.5" /><path d="M2 13L8 13" strokeOpacity="0.5" />
      <path d="M8 7Q12 7 12 10Q12 13 8 13" /><path d="M12 10L17 10" />
    </svg>
  ),
  action: () => kd({ key: "j", metaKey: true }),
};

const UNCOMBINE_ACTION: Action = {
  label: "Uncombine",
  group: "combine",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10L7 10" /><path d="M7 10Q11 10 11 7L17 7" strokeOpacity="0.6" />
      <path d="M7 10Q11 10 11 13L17 13" strokeOpacity="0.6" />
    </svg>
  ),
  action: () => kd({ key: "j", metaKey: true, shiftKey: true }),
};

// Panel is at left:12px, width:80px → tooltip starts at 100px
const TOOLTIP_LEFT = 100;

function Btn({
  a,
  isDark,
  onHover,
  onLeave,
}: {
  a: Action;
  isDark: boolean;
  onHover: (label: string, y: number) => void;
  onLeave: () => void;
}) {
  const isDanger = a.group === "danger";
  return (
    <button
      aria-label={a.label}
      onClick={a.action}
      className="flex items-center justify-center w-10 h-10 transition-colors"
      style={{ color: isDanger ? (isDark ? "#f87171" : "#dc2626") : isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)" }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(a.label, rect.top + rect.height / 2);
        (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
        (e.currentTarget as HTMLElement).style.borderRadius = "8px";
      }}
      onMouseLeave={(e) => {
        onLeave();
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {a.icon}
    </button>
  );
}

export default memo(function SelectControls({
  isDark,
  selectionCount,
  selectionIsCombined,
  selectionIsText,
}: {
  isDark: boolean;
  selectionCount: number;
  selectionIsCombined: boolean;
  selectionIsText: boolean;
}) {
  const bg = isDark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null);
  const onHover = useCallback((label: string, y: number) => setTooltip({ label, y }), []);
  const onLeave = useCallback(() => setTooltip(null), []);

  const viewActions = COMMON_ACTIONS.filter(a => a.group === "view");
  const layerActions = COMMON_ACTIONS.filter(a => a.group === "layer");
  const editActions = COMMON_ACTIONS.filter(a => a.group === "edit");

  const tailActions: Action[] = [
    DANGER_ACTION,
    ...(selectionCount > 1 ? [COMBINE_ACTION] : []),
    ...(selectionIsCombined ? [UNCOMBINE_ACTION] : []),
  ];

  const contextActions = selectionIsText ? TEXT_ACTIONS : DRAWING_ACTIONS;

  const Spacer = () => <div />;
  const Divider = () => (
    <div className="col-span-2" style={{ height: 1, background: border, margin: "0 8px" }} />
  );

  const btn = (a: Action) => (
    <Btn key={a.label} a={a} isDark={isDark} onHover={onHover} onLeave={onLeave} />
  );

  return (
    <>
      {/* Fixed tooltip — escapes overflow container so it never gets clipped */}
      {tooltip && (
        <div
          className="fixed pointer-events-none px-2 py-1 rounded-md text-xs whitespace-nowrap z-50"
          style={{
            left: TOOLTIP_LEFT + 8,
            top: tooltip.y,
            transform: "translateY(-50%)",
            background: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.75)",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          {tooltip.label}
        </div>
      )}

      <div
        className="fixed left-3 top-1/2 -translate-y-1/2 z-30 rounded-xl shadow-lg"
        style={{ background: bg, border: `1px solid ${border}`, backdropFilter: "blur(12px)", maxHeight: "calc(100dvh - 24px)" }}
      >
        {/* Scrollable inner — overflow-y clips tooltips, so tooltips live outside above */}
        <div className="overflow-y-auto rounded-xl" style={{ maxHeight: "calc(100dvh - 24px)" }}>
          <div className="grid grid-cols-2" style={{ width: 80 }}>
            {/* View: zoom spans full width */}
            {viewActions.map(a => (
              <div key={a.label} className="col-span-2 flex">
                {btn(a)}
              </div>
            ))}

            <Divider />

            {/* Layer: 2×2 */}
            {layerActions.map(btn)}
            {layerActions.length % 2 === 1 && <Spacer />}

            <Divider />

            {/* Edit: 2×2 */}
            {editActions.map(btn)}
            {editActions.length % 2 === 1 && <Spacer />}

            <Divider />

            {/* Text or drawing */}
            {contextActions.map(btn)}
            {contextActions.length % 2 === 1 && <Spacer />}

            <Divider />

            {/* Delete + combine/uncombine */}
            {tailActions.map(btn)}
            {tailActions.length % 2 === 1 && <Spacer />}
          </div>
        </div>
      </div>
    </>
  );
});
