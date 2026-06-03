import React from "react";
import { Scissors, Combine, Ungroup, Undo2, Redo2, RotateCw, Layers, Copy, ClipboardPaste, Maximize2, ScanSearch, MoveRight, BringToFront, CopyPlus, Hand, Search, ZoomIn, ZoomOut, MousePointer2, BoxSelect, SquareDashedMousePointer, Frame, Download, Presentation, LayoutDashboard, Square, SquareDashed, Circle } from "lucide-react";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "⌘" : "Ctrl";
const alt = isMac ? "⌥" : "Alt";

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const PanIcon = () => <Hand size={12} strokeWidth={1.5} />;
const ZoomIcon = () => <Search size={12} strokeWidth={1.5} />;
const ZoomInIcon = () => <ZoomIn size={12} strokeWidth={1.5} />;
const ZoomOutIcon = () => <ZoomOut size={12} strokeWidth={1.5} />;
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
const RectIcon = () => <Square size={12} strokeWidth={1.5} />;
const CircleIcon = () => <Circle size={12} strokeWidth={1.5} />;
const ArrowIcon = () => <MoveRight size={12} strokeWidth={1.5} />;
const DashedRectIcon = () => <SquareDashed size={12} strokeWidth={1.5} />;
const FilledRectIcon = () => <svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="0.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" /></svg>;
const LaserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" fill="#ff3030" fillOpacity="0.9" />
    <circle cx="8" cy="8" r="5.5" stroke="#ff3030" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
);
const UndoIcon = () => <Undo2 size={12} strokeWidth={1.5} />;
const RedoIcon = () => <Redo2 size={12} strokeWidth={1.5} />;
const ColorIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none"><circle cx="4" cy="8" r="2.5" fill="#22c55e" opacity="0.7" /><circle cx="11" cy="8" r="2.5" fill="#3b82f6" /></svg>;
const SwapColorIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none"><circle cx="3.5" cy="8" r="2.5" fill="#22c55e" /><circle cx="12.5" cy="8" r="2.5" fill="#3b82f6" /><path d="M9.5 6.5 L6.5 8 L9.5 9.5" fill="currentColor" opacity="0.35" /><path d="M6.5 6.5 L9.5 8 L6.5 9.5" fill="currentColor" opacity="0.35" /></svg>;
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
const ExportIcon = () => <Download size={12} strokeWidth={1.5} />;
const MenuIcon = () => <I><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></I>;
const FullscreenIcon = () => <Maximize2 size={12} strokeWidth={1.5} />;
const GridIcon = () => <Frame size={12} strokeWidth={1.5} />;
const SelectIcon = () => <MousePointer2 size={12} strokeWidth={1.5} />;
const BoxSelectIcon = () => <BoxSelect size={12} strokeWidth={1.5} />;
const AddSelectIcon = () => <SquareDashedMousePointer size={12} strokeWidth={1.5} />;
const CycleIcon = () => <I><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="2" strokeOpacity="0.5" /></I>;
const SelectAllIcon = () => <I><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M5 8h6" strokeWidth="1.2" /></I>;
const CopyIcon = () => <Copy size={12} strokeWidth={1.5} />;
const PasteIcon = () => <ClipboardPaste size={12} strokeWidth={1.5} />;
const CutIcon = () => <Scissors size={12} strokeWidth={1.5} />;
const DuplicateIcon = () => <CopyPlus size={12} strokeWidth={1.5} />;
const LayerIcon = () => <I><rect x="2" y="6" width="8" height="8" rx="1" /><rect x="6" y="2" width="8" height="8" rx="1" strokeOpacity="0.4" /><path d="M10 5V3" strokeOpacity="0.8" /></I>;
const LayerExtremeIcon = () => <BringToFront size={12} strokeWidth={1.5} />;
const DeleteIcon = () => <I><line x1="4" y1="4" x2="12" y2="12" /><line x1="4" y1="12" x2="12" y2="4" /></I>;
const NudgeIcon = () => <I><path d="M8 3v10M3 8h10" /></I>;
const DeselectIcon = () => <I><path d="M3 8h10M8 3v10" strokeOpacity="0.4" /><circle cx="8" cy="8" r="3" /></I>;
const RotateIcon = () => <RotateCw size={12} strokeWidth={1.5} />;
const ZoomSelIcon = () => <ScanSearch size={12} strokeWidth={1.5} />;
const FlipHIcon = () => <I><line x1="8" y1="3" x2="8" y2="13" /><path d="M5 6l-3 2 3 2" /><path d="M11 6l3 2-3 2" strokeOpacity="0.45" /></I>;
const FlipVIcon = () => <I><line x1="3" y1="8" x2="13" y2="8" /><path d="M6 5l2-3 2 3" /><path d="M6 11l2 3 2-3" strokeOpacity="0.45" /></I>;
const LockSelectIcon = () => <I strokeWidth="1.4"><rect x="2" y="2" width="12" height="12" rx="1" /><circle cx="8" cy="8" r="2.5" /></I>;
const ShieldLockIcon = () => <I strokeWidth="1.4"><path d="M8 2.5 L13 4.5 L13 9 Q13 13 8 14.5 Q3 13 3 9 L3 4.5 Z" /></I>;
const CombineIcon = () => <Combine size={12} strokeWidth={1.5} />;
const StashIcon = () => <Layers size={12} strokeWidth={1.5} />;
const UncombineIcon = () => <Ungroup size={12} strokeWidth={1.5} />;
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

export default function ShortcutsPanel({ isDark, modal, isPro }: { isDark: boolean; modal?: boolean; isPro?: boolean }) {
  const kbdClass = isDark
    ? "shrink-0 font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/50"
    : "shrink-0 font-mono px-1.5 py-0.5 rounded border border-black/10 bg-black/[0.04] text-black/50";

  const headingClass = isDark
    ? "font-semibold uppercase tracking-widest mb-2 text-white/25"
    : "font-semibold uppercase tracking-widest mb-2 text-black/25";

  const rowClass = isDark ? "text-white/55" : "text-black/55";

  const Row = ({ label, kbd }: { label: React.ReactNode; kbd: string }) => (
    <div className={`flex items-start justify-between gap-4 ${rowClass}`}>
      <span className="flex items-center gap-1.5 min-w-0 leading-5">{label}</span>
      <kbd className={`${kbdClass} leading-5`}>{kbd}</kbd>
    </div>
  );

  const sectionClass = modal ? "text-[9px]" : "text-[9px]";
  const textClass = modal ? "text-sm" : "text-xs";
  const kbdSizeClass = modal ? "text-[11px]" : "text-[10px]";

  const sections = [
    <div key="nav" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass}`}>Navigation</div>
      <div className={`space-y-1.5 ${textClass}`}>
        <Row label={<><PanIcon />Pan</>} kbd="Space + drag / Arrows" />
        <Row label={<><ZoomIcon />Zoom</>} kbd={`Pinch / ${mod} + scroll`} />
        <Row label={<><ZoomInIcon />Zoom in</>} kbd="+" />
        <Row label={<><ZoomOutIcon />Zoom out</>} kbd="−" />
        <Row label={<><ResetZoomIcon />Reset zoom</>} kbd="⇧ + 1" />
        <Row label={<><FitIcon />Fit to content</>} kbd="⇧ + 2" />
        <Row label={<><PanIcon />Reset view to origin</>} kbd="⇧ + 3" />
        <Row label={<><ZoomSelIcon />Zoom to selection</>} kbd="⇧ + 4" />
      </div>
    </div>,

    <div key="drawing" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass} ${!modal ? "mt-3" : ""}`}>Drawing</div>
      <div className={`space-y-1.5 ${textClass}`}>
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
    </div>,

    <div key="shapes" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass} ${!modal ? "mt-3" : ""}`}>Shapes</div>
      <div className={`space-y-1.5 ${textClass}`}>
        <Row label="Draw shape" kbd="S + drag" />
        <Row label="Cycle shape" kbd="S / ⇧ S" />
        <Row label="Peek active shape" kbd="Hold S" />
        <Row label={<><RectIcon />Rectangle</>} kbd="R + drag" />
        <Row label={<><CircleIcon />Circle</>} kbd="C + drag" />
        <Row label={<><ArrowIcon />Arrow</>} kbd="A + drag" />
        <Row label={<><DashedRectIcon />Dashed shape</>} kbd="⇧ + S + drag" />
        <Row label={<><FilledRectIcon />Filled shape</>} kbd="F + S + drag" />
        <Row label={<><FilledRectIcon />Cycle fill style</>} kbd={`${alt} + F`} />
        <Row label={<><CornersIcon />Rounded / sharp edges</>} kbd="E" />
      </div>
    </div>,

    <div key="text" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass} ${!modal ? "mt-3" : ""}`}>Text</div>
      <div className={`space-y-1.5 ${textClass}`}>
        <Row label={<><TextIcon />Write text</>} kbd="T" />
        <Row label={<><TextSizeIcon />Cycle text size</>} kbd="⇧ + T" />
        <Row label={<><FontIcon />Cycle font</>} kbd="⇧ + Y" />
        <Row label={<><BoldItalicIcon />Bold / Italic</>} kbd={`${mod} + B / I`} />
        <Row label={<><AlignTextIcon />Alignment</>} kbd={`${mod} + ⇧ + L / E / R`} />
        <Row label={<><UndoIcon />Undo typing</>} kbd={`${mod} + Z`} />
        <Row label={<><RedoIcon />Redo typing</>} kbd={`${mod} + ⇧Z`} />
      </div>
    </div>,

    <div key="tools" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass} ${!modal ? "mt-3" : ""}`}>Tools</div>
      <div className={`space-y-1.5 ${textClass}`}>
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
        <Row label={<><ExportIcon />Export canvas</>} kbd={`${mod} + ⇧ + E`} />
        <Row label={<><MenuIcon />Menu</>} kbd="M" />
        <Row label={<><Presentation size={12} strokeWidth={1.5} />Canvas manager</>} kbd="⇧ + M" />
        {isPro && <Row label={<><LayoutDashboard size={12} strokeWidth={1.5} />Workspace manager</>} kbd={`${mod} + O`} />}
        <Row label={<><FullscreenIcon />Fullscreen</>} kbd={`${mod} + F`} />
        <Row label={<><GridIcon />Cycle grid</>} kbd="G / ⇧G" />
        <Row label="Cycle theme" kbd="D D / ⇧D D" />
        <Row label={<><StashIcon />Stash</>} kbd="⇧ + B" />
        <Row label={<><StashIcon />Save to stash</>} kbd={`${mod} ⇧ S`} />
      </div>
    </div>,

    <div key="selection" style={{ breakInside: "avoid" }} className={modal ? "mb-6" : ""}>
      <div className={`${headingClass} ${sectionClass} ${!modal ? "mt-3" : ""}`}>Selection</div>
      <div className={`space-y-1.5 ${textClass}`}>
        <Row label={<><SelectIcon />Select / move / resize</>} kbd="V + hold" />
        <Row label={<><LockSelectIcon />Lock select mode</>} kbd="V V" />
        <Row label={<><BoxSelectIcon />Box select</>} kbd="V + drag" />
        <Row label={<><BoxSelectIcon />Box select (must contain fully)</>} kbd="⇧ + V + drag" />
        <Row label={<><AddSelectIcon />Add / remove from selection</>} kbd="⇧ + V + click" />
        <Row label={<><CycleIcon />Cycle overlapping</>} kbd="Click again" />
        <Row label={<><SelectAllIcon />Select all</>} kbd={`${mod} + A`} />
        <Row label={<><CopyIcon />Copy</>} kbd={`${mod} + C`} />
        <Row label={<><PasteIcon />Paste</>} kbd={`${mod} + V`} />
        <Row label={<><CutIcon />Cut</>} kbd={`${mod} + X`} />
        <Row label={<><DuplicateIcon />Duplicate</>} kbd={`${mod} + D`} />
        <Row label={<><LayerExtremeIcon />To front / To back</>} kbd={`${mod} + ] / [`} />
        <Row label={<><LayerIcon />Bring forward / Send back</>} kbd={`${mod} + ⌥ + ] / [`} />
        <Row label={<><DeleteIcon />Delete</>} kbd="Backspace" />
        <Row label={<><CombineIcon />Combine selection</>} kbd={`${mod} + J`} />
        <Row label={<><UncombineIcon />Uncombine</>} kbd={`${mod} + ⇧ + J`} />
        <Row label={<><RotateIcon />Rotate</>} kbd="Drag rotate handle" />
        <Row label={<><FlipHIcon />Flip horizontal</>} kbd={`${mod} + ⇧ + H`} />
        <Row label={<><FlipVIcon />Flip vertical</>} kbd={`${mod} + ⇧ + V`} />
        <Row label={<><NudgeIcon />Nudge</>} kbd="↑ ↓ ← →" />
        <Row label={<><ZoomSelIcon />Zoom to selection</>} kbd="⇧ + 4" />
        <Row label={<><DeselectIcon />Deselect</>} kbd="Escape" />
        <Row label={<><ShieldLockIcon />Lock / unlock selection</>} kbd="K" />
      </div>
    </div>,
  ];

  if (modal) {
    return (
      <div
        className={kbdSizeClass}
        style={{ columns: "260px", columnGap: "2.5rem" }}
      >
        {sections}
      </div>
    );
  }

  return <div className="text-xs">{sections}</div>;
}
