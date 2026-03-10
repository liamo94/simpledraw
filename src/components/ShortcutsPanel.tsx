import React from "react";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "\u2318" : "Ctrl";
const alt = isMac ? "\u2325" : "Alt";

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const PanIcon = () => <I><path d="M5,8 L2,8 M14,8 L11,8 M8,5 L8,2 M8,14 L8,11" /><path d="M3,8 L5,6.5 M3,8 L5,9.5 M13,8 L11,6.5 M13,8 L11,9.5 M8,3 L6.5,5 M8,3 L9.5,5 M8,13 L6.5,11 M8,13 L9.5,11" /></I>;
const ZoomIcon = () => <I><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></I>;
const ZoomInIcon = () => <I><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /><line x1="5" y1="7" x2="9" y2="7" /><line x1="7" y1="5" x2="7" y2="9" /></I>;
const ZoomOutIcon = () => <I><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /><line x1="5" y1="7" x2="9" y2="7" /></I>;
const ResetZoomIcon = () => <I><path d="M2,8 L14,8 M8,2 L8,14" /><rect x="4" y="4" width="8" height="8" rx="0.5" strokeDasharray="1.5 1.5" /></I>;
const FitIcon = () => <I><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M5,6 L8,4 L11,6 L11,10 L8,12 L5,10 Z" /></I>;
const DrawIcon = () => <I><path d="M3,12 Q5,4 8,8 Q11,12 13,4" /></I>;
const DashedDrawIcon = () => <I strokeDasharray="2 2.5"><path d="M3,12 Q5,4 8,8 Q11,12 13,4" /></I>;
const LineIcon = () => <I><line x1="3" y1="13" x2="13" y2="3" /></I>;
const EraseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" stopColor="#89CFF0" /><stop offset="50%" stopColor="#FA8072" /></linearGradient></defs>
    <rect x="2" y="4" width="12" height="8" rx="1.5" transform="rotate(-15 8 8)" fill="url(#eg)" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
  </svg>
);
const HighlightIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none" opacity="0.5"><rect x="2" y="5" width="12" height="6" rx="1" /></svg>;
const PressureIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M2,8 L14,5 L14,11 Z" opacity="0.7" /></svg>;
const CornersIcon = () => <I><path d="M4,13 L4,4 L13,4" /></I>;
const RectIcon = () => <I><rect x="2" y="3" width="12" height="10" rx="0.5" /></I>;
const CircleIcon = () => <I><circle cx="8" cy="8" r="6" /></I>;
const ArrowIcon = () => <I><line x1="2" y1="8" x2="12" y2="8" /><polyline points="9,5 12,8 9,11" /></I>;
const DashedRectIcon = () => <I strokeDasharray="3 2"><rect x="2" y="3" width="12" height="10" rx="0.5" /></I>;
const FilledRectIcon = () => <svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="0.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" /></svg>;
const LaserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" fill="#ff3030" fillOpacity="0.9" />
    <circle cx="8" cy="8" r="5.5" stroke="#ff3030" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
);
const UndoIcon = () => <I><path d="M12,11 C12,4 4,4 4,9" /><polyline points="2,8 4,10 6,8" /></I>;
const RedoIcon = () => <I><path d="M4,11 C4,4 12,4 12,9" /><polyline points="14,8 12,10 10,8" /></I>;
const ColorIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="4" cy="8" r="2.5" opacity="0.4" /><circle cx="11" cy="8" r="2.5" /></svg>;
const SwapColorIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="5" cy="8" r="2.5" /><path d="M9.5 6.5 L12.5 8 L9.5 9.5" opacity="0.4" /><path d="M12.5 6.5 L9.5 8 L12.5 9.5" opacity="0.4" /></svg>;
const CanvasIcon = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="6" y1="5" x2="6" y2="11" /><line x1="10" y1="5" x2="10" y2="11" /><line x1="2" y1="8" x2="14" y2="8" /></I>;
const RenameIcon = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><text x="8" y="8.5" textAnchor="middle" dominantBaseline="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">Aa</text></I>;
const ThicknessIcon = () => <I><line x1="4" y1="8" x2="12" y2="8" /></I>;
const DotIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="8" cy="8" r="3" /></svg>;
const TextIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <text x="8" y="13" textAnchor="middle" fontSize="14" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text>
  </svg>
);
const TextSizeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <text x="5" y="13" textAnchor="middle" fontSize="14" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text>
    <text x="13" y="13" textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text>
  </svg>
);
const FontIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <text x="5" y="13" textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text>
    <text x="13" y="13" textAnchor="middle" fontSize="13" fontFamily="Georgia,serif" fillOpacity="0.5">a</text>
  </svg>
);
const BoldItalicIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <text x="1" y="12" fontSize="11" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">B</text>
    <text x="9" y="12" fontSize="11" fontStyle="italic" fontFamily="Georgia,serif" fillOpacity="0.55">I</text>
  </svg>
);
const AlignTextIcon = () => <I strokeWidth="1.3"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="10" y2="8" /><line x1="2" y1="12" x2="12" y2="12" /></I>;
const ClearIcon = () => <I><line x1="4" y1="4" x2="12" y2="12" /><line x1="4" y1="12" x2="12" y2="4" /></I>;
const ExportIcon = () => <I><path d="M3 13h10M8 3v7M5 7l3 3 3-3" /></I>;
const MenuIcon = () => <I><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></I>;
const FullscreenIcon = () => <I><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M2,6 L6,6 L6,2 M10,2 L10,6 L14,6 M14,10 L10,10 L10,14 M6,14 L6,10 L2,10" /></I>;
const GridIcon = () => <I strokeOpacity="0.5"><line x1="4" y1="2" x2="4" y2="14" /><line x1="8" y1="2" x2="8" y2="14" /><line x1="12" y1="2" x2="12" y2="14" /><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="14" y2="8" /><line x1="2" y1="12" x2="14" y2="12" /></I>;
const SelectIcon = () => <I strokeWidth="1.4"><rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" /><path d="M8 5v6M5 8h6" strokeWidth="1.2" /></I>;
const BoxSelectIcon = () => <I><rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" /></I>;
const AddSelectIcon = () => <I strokeWidth="1.4"><rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" /><path d="M9 5l3 3-3 3" strokeWidth="1.2" /></I>;
const CycleIcon = () => <I><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="2" strokeOpacity="0.5" /></I>;
const SelectAllIcon = () => <I><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M5 8h6" strokeWidth="1.2" /></I>;
const CopyIcon = () => <I><rect x="2" y="4" width="8" height="10" rx="1" /><path d="M6 4V2.5A.5.5 0 016.5 2h7a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H12" strokeOpacity="0.5" /></I>;
const PasteIcon = () => <I><rect x="2" y="4" width="8" height="10" rx="1" /><path d="M10 2h2.5a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H10" strokeOpacity="0.5" /><path d="M5 9l2 2 4-4" strokeWidth="1.2" /></I>;
const CutIcon = () => <I><path d="M4 4l8 8M4 12l8-8" strokeWidth="1.2" /><rect x="2" y="2" width="12" height="12" rx="1" strokeOpacity="0.3" /></I>;
const DuplicateIcon = () => <I><rect x="1.5" y="3.5" width="8" height="10" rx="1" /><rect x="6.5" y="1.5" width="8" height="10" rx="1" strokeOpacity="0.5" /></I>;
const LayerIcon = () => <I><rect x="2" y="6" width="8" height="8" rx="1" /><rect x="6" y="2" width="8" height="8" rx="1" strokeOpacity="0.4" /><path d="M10 5V3" strokeOpacity="0.8" /></I>;
const LayerExtremeIcon = () => <I><rect x="2" y="6" width="8" height="8" rx="1" /><rect x="6" y="2" width="8" height="8" rx="1" strokeOpacity="0.4" /><path d="M10 5V2M8.5 3.5L10 2l1.5 1.5" strokeOpacity="0.8" /></I>;
const DeleteIcon = () => <I><line x1="4" y1="4" x2="12" y2="12" /><line x1="4" y1="12" x2="12" y2="4" /></I>;
const NudgeIcon = () => <I><path d="M8 3v10M3 8h10" /></I>;
const DeselectIcon = () => <I><path d="M3 8h10M8 3v10" strokeOpacity="0.4" /><circle cx="8" cy="8" r="3" /></I>;
const SprayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="1.5" cy="3.5" r="0.85" fill="currentColor" stroke="none" />
    <circle cx="0.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="1.5" cy="9.5" r="0.75" fill="currentColor" stroke="none" />
    <g transform="rotate(-12 9.5 10)">
      <rect x="6" y="7" width="7" height="8.5" rx="1.5" />
      <rect x="7.5" y="4" width="4" height="3" rx="0.5" />
      <line x1="7.5" y1="5.5" x2="5" y2="5.5" />
    </g>
  </svg>
);

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function ShortcutsPanel({ isDark }: { isDark: boolean }) {
  const kbdClass = isDark
    ? "shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/50"
    : "shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/10 bg-black/[0.04] text-black/50";

  const headingClass = isDark
    ? "text-[9px] font-semibold uppercase tracking-widest mt-3 mb-1.5 text-white/25"
    : "text-[9px] font-semibold uppercase tracking-widest mt-3 mb-1.5 text-black/25";

  const rowClass = isDark ? "text-white/55" : "text-black/55";

  const Row = ({ label, kbd }: { label: React.ReactNode; kbd: string }) => (
    <div className={`flex items-center justify-between gap-4 ${rowClass}`}>
      <span className="flex items-center gap-1.5 min-w-0">{label}</span>
      <kbd className={kbdClass}>{kbd}</kbd>
    </div>
  );

  return (
    <div className="text-xs">
      <div className={headingClass}>Navigation</div>
      <div className="space-y-1">
        <Row label={<><PanIcon />Pan</>} kbd="Space + drag / Arrows" />
        <Row label={<><ZoomIcon />Zoom</>} kbd={`Pinch / ${mod} + scroll`} />
        <Row label={<><ZoomInIcon />Zoom in</>} kbd="+" />
        <Row label={<><ZoomOutIcon />Zoom out</>} kbd="−" />
        <Row label={<><ResetZoomIcon />Reset zoom</>} kbd="⇧ + 1" />
        <Row label={<><FitIcon />Fit to content</>} kbd="⇧ + 2" />
        <Row label={<><PanIcon />Reset view to origin</>} kbd="⇧ + 3" />
      </div>

      <div className={headingClass}>Drawing</div>
      <div className="space-y-1">
        <Row label={<><DrawIcon />Draw</>} kbd={`Click / ${mod} + drag`} />
        <Row label={<><DashedDrawIcon />Draw dashed</>} kbd="Right-click / ⇧ + drag" />
        <Row label={<><LineIcon />Straight line</>} kbd={`${mod} + ⇧ + drag`} />
        <Row label={<><EraseIcon />Erase</>} kbd={`${alt} + drag`} />
        <Row label={<><HighlightIcon />Highlight</>} kbd="W/H + drag" />
        <Row label={<><SprayIcon />Spray paint</>} kbd="B + drag" />
        <Row label={<><PressureIcon />Dynamic stroke</>} kbd="P" />
        <Row label={<><ThicknessIcon />Thicker / Thinner</>} kbd="{ / }" />
        <Row label={<><DotIcon />Place dot</>} kbd="." />
      </div>

      <div className={headingClass}>Shapes</div>
      <div className="space-y-1">
        <Row label="Draw shape" kbd={`${isMac ? "Ctrl" : `${alt} + ⇧`} + drag`} />
        <Row label="Cycle shape" kbd="S" />
        <Row label={<><RectIcon />Rectangle</>} kbd="R + drag" />
        <Row label={<><CircleIcon />Circle</>} kbd="C + drag" />
        <Row label={<><ArrowIcon />Arrow</>} kbd="A + drag" />
        <Row label={<><DashedRectIcon />Dashed shape</>} kbd={`${isMac ? "⇧ + Ctrl" : `⇧ + ${alt}`} + drag`} />
        <Row label={<><FilledRectIcon />Filled shape</>} kbd={`${isMac ? "F + Ctrl" : `F + ${alt}`} + drag`} />
        <Row label={<><FilledRectIcon />Cycle fill style</>} kbd={`${alt} + F`} />
        <Row label={<><CornersIcon />Rounded / sharp edges</>} kbd="E" />
      </div>

      <div className={headingClass}>Text</div>
      <div className="space-y-1">
        <Row label={<><TextIcon />Write text</>} kbd="T" />
        <Row label={<><TextSizeIcon />Cycle text size</>} kbd="⇧ + T" />
        <Row label={<><FontIcon />Cycle font</>} kbd="⇧ + Y" />
        <Row label={<><BoldItalicIcon />Bold / Italic</>} kbd={`${mod} + B / I`} />
        <Row label={<><AlignTextIcon />Alignment</>} kbd={`${mod} + ⇧ + L / E / R`} />
        <Row label={<><UndoIcon />Undo typing</>} kbd={`${mod} + Z`} />
        <Row label={<><RedoIcon />Redo typing</>} kbd={`${mod} + ⇧Z`} />
      </div>

      <div className={headingClass}>Tools</div>
      <div className="space-y-1">
        <Row label={<><LaserIcon />Laser pointer</>} kbd="Q/L + drag" />
        <Row label={<><UndoIcon />Undo</>} kbd={`U / ${mod} + Z`} />
        <Row label={<><RedoIcon />Redo</>} kbd={`⇧ + U / ${mod} + ⇧ + Z`} />
        <Row label={<><ColorIcon />Next / Prev color</>} kbd="] / [" />
        <Row label={<><SwapColorIcon />Swap last 2 colors</>} kbd="," />
        <Row label={<><CanvasIcon />Switch canvas</>} kbd="1 – 9" />
        <Row label={<><CanvasIcon />Jump to cleanest canvas</>} kbd="0" />
        <Row label={<><RenameIcon />Rename canvas</>} kbd={`${mod} + ,`} />
        <Row label={<><ClearIcon />Clear canvas</>} kbd={`${mod} + X`} />
        <Row label={<><ExportIcon />Export</>} kbd={`${mod} + E`} />
        <Row label={<><MenuIcon />Menu</>} kbd="M" />
        <Row label={<><FullscreenIcon />Fullscreen</>} kbd={`${mod} + F`} />
        <Row label={<><GridIcon />Cycle grid</>} kbd="G" />
        <Row label="Cycle theme" kbd="D D" />
      </div>

      <div className={headingClass}>Selection</div>
      <div className="space-y-1">
        <Row label={<><SelectIcon />Select / move / resize</>} kbd="V + hold" />
        <Row label={<><BoxSelectIcon />Box select</>} kbd="V + drag" />
        <Row label={<><AddSelectIcon />Add / remove from selection</>} kbd="⇧ + V + click" />
        <Row label={<><CycleIcon />Cycle overlapping</>} kbd="Click again" />
        <Row label={<><SelectAllIcon />Select all</>} kbd={`${mod} + A`} />
        <Row label={<><CopyIcon />Copy</>} kbd={`${mod} + C`} />
        <Row label={<><PasteIcon />Paste</>} kbd={`${mod} + V`} />
        <Row label={<><CutIcon />Cut</>} kbd={`${mod} + X`} />
        <Row label={<><DuplicateIcon />Duplicate</>} kbd={`${mod} + D`} />
        <Row label={<><LayerIcon />Bring forward / Send back</>} kbd={`${mod} + ] / [`} />
        <Row label={<><LayerExtremeIcon />To front / To back</>} kbd={`${mod} + ⇧ + ] / [`} />
        <Row label={<><DeleteIcon />Delete</>} kbd="Backspace" />
        <Row label={<><NudgeIcon />Nudge</>} kbd="↑ ↓ ← →" />
        <Row label={<><DeselectIcon />Deselect</>} kbd="Escape" />
      </div>
    </div>
  );
}
