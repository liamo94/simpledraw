import { useEffect, useRef, type ReactNode } from 'react'

export function VideoPlaceholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`w-full rounded-2xl flex flex-col items-center justify-center gap-3 ${tall ? 'aspect-[16/9]' : 'aspect-video'}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '2px dashed rgba(255,255,255,0.12)',
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      <p className="text-xs italic text-center max-w-xs px-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
        {label}
      </p>
    </div>
  )
}

function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}

interface FeatureSectionProps {
  flip?: boolean
  videoLabel: string
  badge?: string
  headline: string
  body: ReactNode
}

export function FeatureSection({ flip = false, videoLabel, badge, headline, body }: FeatureSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  const textBlock = (
    <div className="flex flex-col justify-center gap-4">
      {badge && (
        <div
          className="self-start text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
          style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          {badge}
        </div>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ letterSpacing: '-0.01em' }}>
        {headline}
      </h2>
      <div className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {body}
      </div>
    </div>
  )

  const videoBlock = <VideoPlaceholder label={videoLabel} />

  return (
    <section className="py-20 sm:py-28 px-6">
      <div
        ref={ref}
        className="scroll-fade max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        {flip ? <>{textBlock}{videoBlock}</> : <>{videoBlock}{textBlock}</>}
      </div>
    </section>
  )
}

interface USPSectionProps {
  number: '01' | '02'
  flip?: boolean
  headline: string
  body: ReactNode
  videoLabel: string
}

export function USPSection({ number, flip = false, headline, body, videoLabel }: USPSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  const textBlock = (
    <div className="flex flex-col justify-center gap-5">
      <span
        className="self-start font-bold"
        style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '3.5rem', lineHeight: 1, background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        {number}
      </span>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight" style={{ letterSpacing: '-0.02em' }}>
        {headline}
      </h2>
      <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {body}
      </div>
    </div>
  )

  const videoBlock = <VideoPlaceholder label={videoLabel} />

  return (
    <section
      className="py-20 sm:py-28 px-6"
      style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.04) 0%, transparent 100%)' }}
    >
      <div
        ref={ref}
        className="scroll-fade max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        {flip ? <>{textBlock}{videoBlock}</> : <>{videoBlock}{textBlock}</>}
      </div>
    </section>
  )
}

interface SpotlightSectionProps {
  badge?: string
  headline: string
  body: ReactNode
  videoLabel: string
}

export function SpotlightSection({ badge, headline, body, videoLabel }: SpotlightSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          {badge && (
            <div
              className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
              style={{ background: 'rgba(236,72,153,0.1)', color: '#f9a8d4', border: '1px solid rgba(236,72,153,0.2)' }}
            >
              {badge}
            </div>
          )}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
            {headline}
          </h2>
          <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {body}
          </div>
        </div>
        <VideoPlaceholder label={videoLabel} />
      </div>
    </section>
  )
}
