import React, { useEffect, useRef, type ReactNode } from 'react'
import {
  Square, Circle, Triangle, Diamond, Pentagon, Hexagon, Star, Cloud,
  Hand, Layers, Presentation, MousePointer2, BoxSelect, Search, ZoomIn, Frame,
  Upload, Copy, Image, Keyboard, Undo2, LayoutDashboard, MoveRight,
} from 'lucide-react'

// ── Shared wrapper matching ShortcutsPanel's icon style ──────────────────────
const I = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props} />
)

// ── Custom icons (exact same paths as ShortcutsPanel.tsx) ────────────────────
const DrawIcon       = () => <I><path d="M3,12 Q5,4 8,8 Q11,12 13,4" /></I>
const DashedDrawIcon = () => <I strokeDasharray="2 2.5"><path d="M3,12 Q5,4 8,8 Q11,12 13,4" /></I>
const LineIcon       = () => <I><line x1="3" y1="13" x2="13" y2="3" /></I>
const HighlightIcon  = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none" opacity="0.5"><rect x="2" y="5" width="12" height="6" rx="1" /></svg>
const PressureIcon   = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M2,8.5 C4,7 7,4.5 14,8 C7,11.5 4,10 2,8.5 Z" opacity="0.7" /></svg>
const ThicknessIcon  = () => <I><line x1="4" y1="8" x2="12" y2="8" /></I>
const DotIcon        = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="8" cy="8" r="3" /></svg>
const FilledRectIcon = () => <svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="0.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" /></svg>
const CornersIcon    = () => <I><path d="M4,13 L4,4 L13,4" /></I>
const ColorIcon      = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none"><circle cx="4.5" cy="8" r="3" fill="#22c55e" opacity="0.7" /><circle cx="11.5" cy="8" r="3" fill="#3b82f6" /></svg>
const FontIcon       = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="5" y="13" textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text><text x="13" y="13" textAnchor="middle" fontSize="13" fontFamily="Georgia,serif" fillOpacity="0.5">a</text></svg>
const TextSizeIcon   = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="5" y="13" textAnchor="middle" fontSize="14" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text><text x="13" y="13" textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text></svg>
const TextIcon       = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="8" y="13" textAnchor="middle" fontSize="14" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">A</text></svg>
const BoldItalicIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="1" y="12" fontSize="11" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">B</text><text x="9" y="12" fontSize="11" fontStyle="italic" fontFamily="Georgia,serif" fillOpacity="0.55">I</text></svg>
const AlignTextIcon  = () => <I strokeWidth="1.3"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="10" y2="8" /><line x1="2" y1="12" x2="12" y2="12" /></I>
const CanvasIcon     = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="6" y1="5" x2="6" y2="11" /><line x1="10" y1="5" x2="10" y2="11" /><line x1="2" y1="8" x2="14" y2="8" /></I>
const RenameIcon     = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><text x="8" y="11.5" textAnchor="middle" dominantBaseline="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">Aa</text></I>
const ShareIcon      = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="13" cy="3" r="2" /><circle cx="3" cy="8" r="2" /><circle cx="13" cy="13" r="2" /><line x1="5" y1="7" x2="11" y2="4" /><line x1="5" y1="9" x2="11" y2="12" /></svg>
const CheckIcon      = () => <I strokeWidth="1.8"><polyline points="2,8 6,12 14,4" /></I>
const ShieldIcon     = () => <I strokeWidth="1.4"><path d="M8 2.5 L13 4.5 L13 9 Q13 13 8 14.5 Q3 13 3 9 L3 4.5 Z" /></I>
const FitIcon        = () => <I><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M5,6 L8,4 L11,6 L11,10 L8,12 L5,10 Z" /></I>
const CloudSyncIcon  = () => <I><path d="M10.5 12.5H5.5a3 3 0 0 1 0-6h.1A3.5 3.5 0 0 1 13 8.5a2 2 0 0 1-2 2" /><path d="M9 11l2 2 2-2" /></I>
const EraseIcon      = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <defs><linearGradient id="af-eg" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" stopColor="#89CFF0" /><stop offset="50%" stopColor="#FA8072" /></linearGradient></defs>
    <rect x="2" y="4" width="12" height="8" rx="1.5" transform="rotate(-15 8 8)" fill="url(#af-eg)" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
  </svg>
)
const LaserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" fill="#ff3030" fillOpacity="0.9" />
    <circle cx="8" cy="8" r="5.5" stroke="#ff3030" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
)
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
)
const ThemeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none">
    <rect x="1" y="5" width="4" height="6" rx="0.5" fill="#06060e" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
    <rect x="6" y="5" width="4" height="6" rx="0.5" fill="#fffce0" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
    <rect x="11" y="5" width="4" height="6" rx="0.5" fill="#eaf4fb" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
  </svg>
)
const MouseButtonIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="2" width="7" height="12" rx="3.5" />
    <line x1="8" y1="2" x2="8" y2="7.5" />
    <line x1="4.5" y1="7.5" x2="11.5" y2="7.5" />
  </svg>
)

// ── Pro badge ────────────────────────────────────────────────────────────────
const ProBadge = () => (
  <span style={{
    fontSize: '8px', padding: '1px 5px', borderRadius: '3px', flexShrink: 0,
    background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
    border: '1px solid rgba(59,130,246,0.25)', fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.4,
  }}>Pro</span>
)

// ── Item type ────────────────────────────────────────────────────────────────
type Item = { label: string; icon: ReactNode; pro?: boolean }

const FEATURE_GROUPS: { label: string; groupIcon: ReactNode; items: Item[] }[] = [
  {
    label: 'Drawing tools',
    groupIcon: <DrawIcon />,
    items: [
      { label: 'Freehand',        icon: <DrawIcon /> },
      { label: 'Dashed freehand', icon: <DashedDrawIcon /> },
      { label: 'Straight line',   icon: <LineIcon /> },
      { label: 'Highlight',       icon: <HighlightIcon /> },
      { label: 'Spray paint',     icon: <SprayIcon /> },
      { label: 'Laser pointer',   icon: <LaserIcon /> },
      { label: 'Eraser',          icon: <EraseIcon /> },
      { label: 'Select, move & resize', icon: <MousePointer2 size={12} strokeWidth={1.5} /> },
      { label: 'Text tool',       icon: <TextIcon /> },
      { label: 'Hand / pan',      icon: <Hand size={12} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Shapes',
    groupIcon: <Square size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Circle',         icon: <Circle size={12} strokeWidth={1.5} /> },
      { label: 'Rectangle',      icon: <Square size={12} strokeWidth={1.5} /> },
      { label: 'Triangle',       icon: <Triangle size={12} strokeWidth={1.5} /> },
      { label: 'Arrow',          icon: <MoveRight size={12} strokeWidth={1.5} /> },
      { label: 'Star',           icon: <Star size={12} strokeWidth={1.5} /> },
      { label: 'Pentagon',       icon: <Pentagon size={12} strokeWidth={1.5} /> },
      { label: 'Hexagon',        icon: <Hexagon size={12} strokeWidth={1.5} /> },
      { label: 'Diamond',        icon: <Diamond size={12} strokeWidth={1.5} /> },
      { label: 'Cloud',          icon: <Cloud size={12} strokeWidth={1.5} /> },
      { label: 'Multi-bend lines & arrows', icon: <LineIcon /> },
    ],
  },
  {
    label: 'Customisation',
    groupIcon: <ColorIcon />,
    items: [
      { label: '8 themes',               icon: <ThemeIcon /> },
      { label: 'Dot & square grids',     icon: <Frame size={12} strokeWidth={1.5} /> },
      { label: '13 preset colours',        icon: <ColorIcon /> },
      { label: 'Custom colour picker',    icon: <ColorIcon />, pro: true },
      { label: 'Line width',             icon: <ThicknessIcon /> },
      { label: 'Fill & opacity',         icon: <FilledRectIcon /> },
      { label: 'Dashed outlines',        icon: <DashedDrawIcon /> },
      { label: 'Right-click tool binding', icon: <MouseButtonIcon /> },
      { label: 'Sharp or rounded shapes',icon: <CornersIcon /> },
    ],
  },
  {
    label: 'Text & fonts',
    groupIcon: <FontIcon />,
    items: [
      { label: '6 font families',          icon: <FontIcon /> },
      { label: '5 text sizes + free resize', icon: <TextSizeIcon /> },
      { label: 'Bold & italic',            icon: <BoldItalicIcon /> },
      { label: 'Left / centre / right align', icon: <AlignTextIcon /> },
      { label: 'Edit text in place',        icon: <TextIcon /> },
    ],
  },
  {
    label: 'Touch & input',
    groupIcon: <Hand size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Apple Pencil & pressure sensitivity', icon: <PressureIcon /> },
      { label: 'Palm rejection',       icon: <Hand size={12} strokeWidth={1.5} /> },
      { label: 'Pinch to zoom',        icon: <ZoomIn size={12} strokeWidth={1.5} /> },
      { label: 'Two-finger pan',       icon: <Hand size={12} strokeWidth={1.5} /> },
      { label: 'Finger drawing',       icon: <DrawIcon /> },
      { label: 'Mobile toolbar',       icon: <I><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></I> },
    ],
  },
  {
    label: 'Canvas & navigation',
    groupIcon: <CanvasIcon />,
    items: [
      { label: 'Infinite canvas',           icon: <CanvasIcon /> },
      { label: '3 slots free / 9 with',      icon: <CanvasIcon />, pro: true },
      { label: '1–3 key switching, 1–9 with', icon: <CanvasIcon />, pro: true },
      { label: 'Undo / redo',               icon: <Undo2 size={12} strokeWidth={1.5} /> },
      { label: 'Zoom & fit',                icon: <FitIcon /> },
      { label: 'Group select, resize & rotate', icon: <BoxSelect size={12} strokeWidth={1.5} /> },
      { label: 'Move & delete selection',   icon: <MousePointer2 size={12} strokeWidth={1.5} /> },
      { label: 'Image insertion',           icon: <Image size={12} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Stash',
    groupIcon: <Layers size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Save any strokes',       icon: <Layers size={12} strokeWidth={1.5} /> },
      { label: 'Drag back onto canvas',  icon: <CanvasIcon /> },
      { label: 'Rename stash items',      icon: <RenameIcon /> },
      { label: 'Search stash',           icon: <Search size={12} strokeWidth={1.5} /> },
      { label: 'Reorder & delete',       icon: <I><line x1="4" y1="4" x2="12" y2="12" /><line x1="4" y1="12" x2="12" y2="4" /></I> },
      { label: 'Auto colour-adapts to theme', icon: <ColorIcon /> },
      { label: 'Cloud stash sync',       icon: <CloudSyncIcon />, pro: true },
    ],
  },
  {
    label: 'Export & share',
    groupIcon: <ShareIcon />,
    items: [
      { label: 'PNG export',                  icon: <Upload size={12} strokeWidth={1.5} /> },
      { label: 'SVG export',                   icon: <Upload size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Export selection',             icon: <BoxSelect size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Share links',                 icon: <ShareIcon /> },
      { label: 'Live canvas share link',      icon: <ShareIcon />, pro: true },
      { label: 'Workspace share link',         icon: <ShareIcon />, pro: true },
      { label: 'Anyone can view share links',  icon: <CheckIcon /> },
      { label: 'Copy to clipboard',           icon: <Copy size={12} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Cloud',
    groupIcon: <CloudSyncIcon />,
    items: [
      { label: 'Canvas sync across devices', icon: <CloudSyncIcon /> },
      { label: 'Auto-save',                  icon: <DotIcon /> },
      { label: 'Before-close backup',        icon: <ShieldIcon /> },
      { label: 'Workspaces',                  icon: <LayoutDashboard size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Stash sync',                 icon: <Layers size={12} strokeWidth={1.5} />,    pro: true },
    ],
  },
  {
    label: 'Other',
    groupIcon: <Presentation size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Full keyboard shortcuts', icon: <Keyboard size={12} strokeWidth={1.5} /> },
      { label: 'Shortcuts panel',          icon: <I><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></I> },
      { label: 'Interactive tutorial',    icon: <Presentation size={12} strokeWidth={1.5} /> },
      { label: 'Drawing challenges',      icon: <Presentation size={12} strokeWidth={1.5} /> },
      { label: 'No account needed',       icon: <CheckIcon /> },
      { label: 'Works offline',           icon: <CheckIcon /> },
    ],
  },
]

export function AllFeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.05 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            Everything included
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ letterSpacing: '-0.02em' }}
          >
            The full feature list
          </h2>
          <p className="mt-4 text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            No hidden features. Everything you need, right there when you open it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_GROUPS.map(group => (
            <div
              key={group.label}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#93c5fd' }}>
                <span className="opacity-80">{group.groupIcon}</span>
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.map(item => (
                  <li key={item.label} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.icon}</span>
                    {item.label}
                    {item.pro && <ProBadge />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
