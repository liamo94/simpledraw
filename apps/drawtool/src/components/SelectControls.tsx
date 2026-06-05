import { memo, useState, useCallback, useEffect } from "react";
import { Layers, Scissors, Combine, Ungroup, BringToFront, SendToBack, CopyPlus, ScanSearch, ImageDown } from "lucide-react";
import type React from "react";
import { getPanelBackground } from "../canvas/rendering";
import type { Theme } from "../hooks/useSettings";

export type Action = { label: string; group: string; icon: React.ReactNode; action: () => void };

export const kd = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

export const COMMON_ACTIONS: Action[] = [
  {
    label: "Zoom to selection",
    group: "view",
    icon: <ScanSearch size={20} strokeWidth={1.75} />,
    action: () => kd({ key: "4", shiftKey: true }),
  },
  {
    label: "To front",
    group: "layer",
    icon: <BringToFront size={20} strokeWidth={1.75} />,
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
    icon: <SendToBack size={20} strokeWidth={1.75} />,
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
    icon: <Scissors size={20} strokeWidth={1.75} />,
    action: () => kd({ key: "x", metaKey: true }),
  },
  {
    label: "Duplicate",
    group: "edit",
    icon: <CopyPlus size={20} strokeWidth={1.75} />,
    action: () => kd({ key: "d", metaKey: true }),
  },
  {
    label: "Paste",
    group: "edit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="10" height="13" rx="1.5" />
        <path d="M7 5V3.5A1.5 1.5 0 018.5 2h7A1.5 1.5 0 0117 3.5v11a1.5 1.5 0 01-1.5 1.5H14" strokeOpacity="0.45" />
        <path d="M5 9h4M5 12h6M5 15h3" strokeOpacity="0.6" />
      </svg>
    ),
    action: () => window.dispatchEvent(new Event("drawtool:paste")),
  },
  {
    label: "Save to stash",
    group: "edit",
    icon: <Layers size={20} strokeWidth={1.75} />,
    action: () => window.dispatchEvent(new Event("drawtool:save-to-stash")),
  },
];

export const DRAWING_ACTIONS: Action[] = [
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

export const TEXT_ACTIONS: Action[] = [
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

export const DANGER_ACTION: Action = {
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

export const COMBINE_ACTION: Action = {
  label: "Combine",
  group: "combine",
  icon: <Combine size={20} strokeWidth={1.75} />,
  action: () => kd({ key: "j", metaKey: true }),
};

export const UNCOMBINE_ACTION: Action = {
  label: "Uncombine",
  group: "combine",
  icon: <Ungroup size={20} strokeWidth={1.75} />,
  action: () => kd({ key: "j", metaKey: true, shiftKey: true }),
};

// Panel sits at left:12px (left-3)
const PANEL_LEFT = 12;
const PANEL_WIDTH_1COL = 52;
const PANEL_WIDTH_2COL = 88;

function Btn({
  a,
  isDark,
  onHover,
  onLeave,
  isActive,
}: {
  a: Action;
  isDark: boolean;
  onHover: (label: string, y: number) => void;
  onLeave: () => void;
  isActive?: boolean;
}) {
  const isDanger = a.group === "danger";
  const color = isActive
    ? (isDark ? "#78b8ff" : "#2d64c8")
    : isDanger
    ? (isDark ? "#f87171" : "#dc2626")
    : isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  return (
    <button
      aria-label={a.label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        a.action();
      }}
      className={`flex items-center justify-center w-full h-10 rounded-lg transition-colors duration-150 ${isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"}`}
      style={{ color, touchAction: "manipulation" }}
      onPointerEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(a.label, rect.top + rect.height / 2);
      }}
      onPointerLeave={onLeave}
    >
      {a.icon}
    </button>
  );
}

export default memo(function SelectControls({
  isDark,
  theme,
  selectionCount,
  selectionIsCombined,
  selectionIsText,
  selectionIsLocked,
  isPro,
}: {
  isDark: boolean;
  theme: Theme;
  selectionCount: number;
  selectionIsCombined: boolean;
  selectionIsText: boolean;
  selectionIsLocked: boolean;
  isPro: boolean;
}) {
  const bg = getPanelBackground(theme);
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null);
  const onHover = useCallback((label: string, y: number) => setTooltip({ label, y }), []);
  const onLeave = useCallback(() => setTooltip(null), []);

  const viewActions = COMMON_ACTIONS.filter(a => a.group === "view");
  const layerActions = COMMON_ACTIONS.filter(a => a.group === "layer");
  const baseEditActions = COMMON_ACTIONS.filter(a => a.group === "edit");
  const exportSelectionAction: Action = {
    label: "Export selection",
    group: "edit",
    icon: <ImageDown size={20} strokeWidth={1.75} />,
    action: () => window.dispatchEvent(new CustomEvent("drawtool:export-selection-png")),
  };
  const editActions = isPro ? [...baseEditActions, exportSelectionAction] : baseEditActions;

  const lockAction: Action = {
    label: selectionIsLocked ? "Unlock" : "Lock",
    group: "lock",
    icon: selectionIsLocked ? (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="9" width="12" height="9" rx="1.5" />
        <path d="M7 9V6.5a3 3 0 016 0" />
      </svg>
    ) : (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="9" width="12" height="9" rx="1.5" />
        <path d="M7 9V6.5a3 3 0 016 0V9" />
      </svg>
    ),
    action: () => kd({ key: "k" }),
  };

  const tailActions: Action[] = [
    DANGER_ACTION,
    ...(selectionCount > 1 ? [COMBINE_ACTION] : []),
    ...(selectionIsCombined ? [UNCOMBINE_ACTION] : []),
  ];

  const contextActions = selectionIsText ? TEXT_ACTIONS : DRAWING_ACTIONS;

  // Switch to 2-col when content won't fit 1-col in the available viewport.
  // Each button ~42px, 5 dividers ~9px each, 12px padding; 132px reserved for safe areas.
  const totalButtons = viewActions.length + layerActions.length + editActions.length + contextActions.length + 1 + tailActions.length;
  const estimated1ColHeight = totalButtons * 42 + 5 * 9 + 12;
  const twoCol = windowHeight - 132 < estimated1ColHeight;
  const panelWidth = twoCol ? PANEL_WIDTH_2COL : PANEL_WIDTH_1COL;
  const tooltipLeft = PANEL_LEFT + panelWidth + 8;

  // In 2-col mode, single items and dividers span both columns
  const Divider = () => (
    <div
      className={twoCol ? "col-span-2" : undefined}
      style={{ height: 1, background: border, margin: "2px 6px" }}
    />
  );

  // Wraps a single button so it spans full width in 2-col grid
  const Full = ({ children }: { children: React.ReactNode }) =>
    twoCol ? <div className="col-span-2">{children}</div> : <>{children}</>;

  // Fills the empty cell when a section has an odd number of items
  const Spacer = () => twoCol ? <div /> : null;

  const btn = (a: Action, active?: boolean) => (
    <Btn key={a.label} a={a} isDark={isDark} onHover={onHover} onLeave={onLeave} isActive={active} />
  );

  const containerClass = twoCol
    ? "grid grid-cols-2 gap-0.5"
    : "flex flex-col gap-0.5";

  return (
    <>
      {tooltip && (
        <div
          className="fixed pointer-events-none px-2 py-1 rounded-md text-xs whitespace-nowrap z-50"
          style={{
            left: tooltipLeft,
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
        className="fixed left-3 -translate-y-1/2 z-30 rounded-xl shadow-lg"
        style={{ background: bg, border: `1px solid ${border}`, backdropFilter: "blur(12px)", top: "calc(50dvh - 22px)", maxHeight: "calc(100dvh - 132px)", width: panelWidth }}
      >
        <div className="overflow-y-auto rounded-xl" style={{ maxHeight: "calc(100dvh - 132px)" }}>
          <div className={`${containerClass} p-1.5`}>
            <Full>{viewActions.map(a => btn(a))}</Full>

            <Divider />

            {layerActions.map(a => btn(a))}

            <Divider />

            {editActions.map(a => btn(a))}
            {editActions.length % 2 === 1 && <Spacer />}

            <Divider />

            {contextActions.map(a => btn(a))}
            {contextActions.length % 2 === 1 && <Spacer />}

            <Divider />

            {btn(lockAction, selectionIsLocked)}
            {!twoCol && <Divider />}
            {tailActions.map(a => btn(a))}
            {(1 + tailActions.length) % 2 === 1 && <Spacer />}
          </div>
        </div>
      </div>
    </>
  );
});
