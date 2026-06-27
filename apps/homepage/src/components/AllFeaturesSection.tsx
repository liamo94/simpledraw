import React, { useEffect, useRef, type ReactNode } from 'react'
import {
  Square, Circle, Triangle, Diamond, Pentagon, Hexagon, Star, Cloud,
  Hand, Layers, Presentation, MousePointer2, BoxSelect, Search, ZoomIn, Frame,
  Upload, Copy, Image, Keyboard, Undo2, LayoutDashboard, MoveRight, CloudDownload,
  Share2, Check, Shield, Eraser, MouseRight, Highlighter, Maximize2, AlignLeft,
  Type, Dot, Bold, SprayCan, Minus, ALargeSmall,
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
const PressureIcon   = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M2,8.5 C4,7 7,4.5 14,8 C7,11.5 4,10 2,8.5 Z" opacity="0.7" /></svg>
const FilledRectIcon = () => <svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="0.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" /></svg>
const CornersIcon    = () => <I><path d="M4,13 L4,4 L13,4" /></I>
const ColorIcon      = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none"><circle cx="4.5" cy="8" r="3" fill="#22c55e" opacity="0.7" /><circle cx="11.5" cy="8" r="3" fill="#3b82f6" /></svg>
const CanvasIcon     = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="6" y1="5" x2="6" y2="11" /><line x1="10" y1="5" x2="10" y2="11" /><line x1="2" y1="8" x2="14" y2="8" /></I>
const RenameIcon     = () => <I strokeWidth="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" /><text x="8" y="11.5" textAnchor="middle" dominantBaseline="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">Aa</text></I>
const LaserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" fill="#ff3030" fillOpacity="0.9" />
    <circle cx="8" cy="8" r="5.5" stroke="#ff3030" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
)
const ThemeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="none">
    <rect x="1" y="5" width="4" height="6" rx="0.5" fill="#06060e" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
    <rect x="6" y="5" width="4" height="6" rx="0.5" fill="#fffce0" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
    <rect x="11" y="5" width="4" height="6" rx="0.5" fill="#eaf4fb" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
  </svg>
)

// ── Pro badge ────────────────────────────────────────────────────────────────
const ProBadge = () => (
  <span style={{
    fontFamily: "'Bangers', cursive",
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    color: '#39ff14',
    flexShrink: 0,
    lineHeight: 1,
  }}>UNLEASHED</span>
)

// ── Item type ────────────────────────────────────────────────────────────────
type Item = { label: string; icon: ReactNode; pro?: boolean }

const FEATURE_GROUPS: { label: string; groupIcon: ReactNode; items: Item[] }[] = [
  {
    label: 'Drawing tools',
    groupIcon: <DrawIcon />,
    items: [
      { label: 'Freehand',              icon: <DrawIcon /> },
      { label: 'Smooth, tapered strokes', icon: <DrawIcon /> },
      { label: 'Dashed freehand',       icon: <DashedDrawIcon /> },
      { label: 'Straight line',   icon: <LineIcon /> },
      { label: 'Highlight',       icon: <Highlighter size={12} strokeWidth={1.5} /> },
      { label: 'Spray paint',     icon: <SprayCan size={12} strokeWidth={1.5} /> },
      { label: 'Laser pointer',   icon: <LaserIcon /> },
      { label: 'Eraser',          icon: <Eraser size={12} strokeWidth={1.5} /> },
      { label: 'Select, move & resize', icon: <MousePointer2 size={12} strokeWidth={1.5} /> },
      { label: 'Text tool',       icon: <Type size={12} strokeWidth={1.5} /> },
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
      { label: 'Line width',             icon: <Minus size={12} strokeWidth={1.5} /> },
      { label: 'Fill & opacity',         icon: <FilledRectIcon /> },
      { label: 'Dashed outlines',        icon: <DashedDrawIcon /> },
      { label: 'Right-click tool binding', icon: <MouseRight size={12} strokeWidth={1.5} /> },
      { label: 'Sharp or rounded shapes',icon: <CornersIcon /> },
    ],
  },
  {
    label: 'Text & fonts',
    groupIcon: <Type size={14} strokeWidth={1.5} />,
    items: [
      { label: '6 font families',          icon: <Type size={12} strokeWidth={1.5} /> },
      { label: '5 text sizes + free resize', icon: <ALargeSmall size={12} strokeWidth={1.5} /> },
      { label: 'Bold & italic',            icon: <Bold size={12} strokeWidth={1.5} /> },
      { label: 'Left / centre / right align', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
      { label: 'Edit text in place',        icon: <Type size={12} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Touch & input',
    groupIcon: <Hand size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Apple Pencil support',          icon: <PressureIcon /> },
      { label: 'Pressure-sensitive line width', icon: <PressureIcon /> },
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
      { label: 'Zoom & fit',                icon: <Maximize2 size={12} strokeWidth={1.5} /> },
      { label: 'Reorder canvas slots',      icon: <CanvasIcon /> },
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
    ],
  },
  {
    label: 'Export & share',
    groupIcon: <Share2 size={14} strokeWidth={1.5} />,
    items: [
      { label: 'PNG export',                  icon: <Upload size={12} strokeWidth={1.5} /> },
      { label: 'Watermark-free export',        icon: <Upload size={12} strokeWidth={1.5} />, pro: true },
      { label: 'SVG export',                   icon: <Upload size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Export selection',             icon: <BoxSelect size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Share links',                 icon: <Share2 size={12} strokeWidth={1.5} /> },
      { label: 'Live canvas share link',      icon: <Share2 size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Workspace share link',         icon: <Share2 size={12} strokeWidth={1.5} />, pro: true },
      { label: 'Anyone can view share links',  icon: <Check size={12} strokeWidth={1.5} /> },
      { label: 'Copy to clipboard',           icon: <Copy size={12} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Cloud',
    groupIcon: <CloudDownload size={14} strokeWidth={1.5} />,
    items: [
      { label: 'Canvas sync across devices', icon: <CloudDownload size={12} strokeWidth={1.5} /> },
      { label: 'Auto-save',                  icon: <Dot size={12} strokeWidth={1.5} /> },
      { label: 'Before-close backup',        icon: <Shield size={12} strokeWidth={1.5} /> },
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
      { label: 'No account needed',       icon: <Check size={12} strokeWidth={1.5} /> },
      { label: 'Works offline',           icon: <Check size={12} strokeWidth={1.5} /> },
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
          <div className="inline-block mb-6 font-bold" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '2.5rem', lineHeight: 1, background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
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
          {FEATURE_GROUPS.map((group, i) => {
            const lastAlone = i === FEATURE_GROUPS.length - 1 && FEATURE_GROUPS.length % 3 === 1
            return (
            <div
              key={group.label}
              className={`rounded-2xl p-6${lastAlone ? ' lg:col-start-2' : ''}`}
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
            )
          })}
        </div>
      </div>
    </section>
  )
}
