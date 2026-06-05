import { useEffect, useRef, type ReactNode } from 'react'
import { VideoPlaceholder } from './FeatureSection'

interface Feature {
  icon: ReactNode
  title: string
  body: string
  align: 'left' | 'right'
}

const I = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props} />
)

const PressureIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <path d="M2,8.5 C4,7 7,4.5 14,8 C7,11.5 4,10 2,8.5 Z" opacity="0.8" />
  </svg>
)
const PalmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
)
const PinchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="3" />
    <path d="M8 2v2M8 12v2M2 8h2M12 8h2" />
  </svg>
)
const ToolbarIcon = () => (
  <I>
    <rect x="1" y="10" width="14" height="5" rx="1.5" />
    <line x1="4" y1="12.5" x2="4" y2="12.5" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="8" y1="12.5" x2="8" y2="12.5" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="12" y1="12.5" x2="12" y2="12.5" strokeWidth="2.5" strokeLinecap="round" />
  </I>
)
const FingerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2v8a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2z" />
    <path d="M16 8a2 2 0 1 1 4 0v6a8 8 0 0 1-16 0V9a2 2 0 1 1 4 0v3" />
  </svg>
)
const UndoGestureIcon = () => (
  <I>
    <path d="M4 7H12a3 3 0 0 1 0 6H8" />
    <path d="M6.5 4.5L4 7l2.5 2.5" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
  </I>
)

const FEATURES: Feature[] = [
  {
    align: 'left',
    icon: <PressureIcon />,
    title: 'Pressure & tilt',
    body: 'Apple Pencil tilt and pressure shape every stroke. Lean in, press harder, go light - drawzilla responds like real media.',
  },
  {
    align: 'left',
    icon: <PalmIcon />,
    title: 'Palm rejection',
    body: 'Rest your hand fully on the screen while drawing. drawzilla distinguishes stylus from palm and ignores the rest.',
  },
  {
    align: 'left',
    icon: <PinchIcon />,
    title: 'Pinch to zoom',
    body: 'Two fingers to zoom and pan anywhere on the infinite canvas - no mode switch, no toolbar.',
  },
  {
    align: 'right',
    icon: <ToolbarIcon />,
    title: 'Mobile toolbar',
    body: 'A dedicated toolbar keeps every tool reachable with your thumb. Swipe it to switch canvases.',
  },
  {
    align: 'right',
    icon: <FingerIcon />,
    title: 'Finger drawing',
    body: 'No Apple Pencil? No problem. Draw with a finger, zoom with two. Everything works.',
  },
  {
    align: 'right',
    icon: <UndoGestureIcon />,
    title: 'Gesture shortcuts',
    body: 'Two-finger tap undoes. Three-finger tap redoes. No buttons needed.',
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className={`flex gap-3 ${feature.align === 'right' ? 'flex-row-reverse text-right lg:flex-row lg:text-left' : ''}`}>
      <div
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
        style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}
      >
        {feature.icon}
      </div>
      <div>
        <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {feature.title}
        </div>
        <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {feature.body}
        </div>
      </div>
    </div>
  )
}

export function TabletSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const leftFeatures  = FEATURES.filter(f => f.align === 'left')
  const rightFeatures = FEATURES.filter(f => f.align === 'right')

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">

        <div className="text-center max-w-2xl mx-auto mb-14">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            iPad & tablet
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
            A canvas that feels made for touch
          </h2>
          <p className="text-base sm:text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
            From Apple Pencil pressure to palm rejection to gesture shortcuts - drawzilla is as at home on an iPad as it is on a laptop.
          </p>
        </div>

        {/* Desktop: three-column. Mobile: video first, then features in 2-col grid */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_300px_1fr] lg:gap-10 lg:items-center">
          {/* Left features */}
          <div className="space-y-8">
            {leftFeatures.map(f => <FeatureCard key={f.title} feature={f} />)}
          </div>

          {/* Portrait video */}
          <div className="w-full">
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <VideoPlaceholder label="VIDEO: iPad / tablet footage - Apple Pencil drawing, palm rejection, pinch-zoom, mobile toolbar usage" portrait />
            </div>
          </div>

          {/* Right features */}
          <div className="space-y-8">
            {rightFeatures.map(f => <FeatureCard key={f.title} feature={f} />)}
          </div>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden flex flex-col items-center gap-10">
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <VideoPlaceholder label="VIDEO: iPad / tablet footage" portrait />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            {FEATURES.map(f => <FeatureCard key={f.title} feature={f} />)}
          </div>
        </div>

      </div>
    </section>
  )
}
