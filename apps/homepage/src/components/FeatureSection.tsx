import { useEffect, useRef, type ReactNode } from 'react'

export function VideoPlaceholder({ label, tall, portrait, src, imgSrc, natural, cropTop }: { label: string; tall?: boolean; portrait?: boolean; src?: string; imgSrc?: string; natural?: boolean; cropTop?: number }) {
  const aspectClass = portrait ? 'aspect-[3/4]' : tall ? 'aspect-[16/9]' : 'aspect-video'
  if (imgSrc) {
    return <img src={imgSrc} alt={label} className="w-full rounded-2xl" />
  }
  if (src) {
    const video = (
      <video
        src={src}
        className={natural ? 'w-full rounded-2xl' : `w-full rounded-2xl object-cover ${aspectClass}`}
        style={cropTop ? { marginTop: -cropTop, display: 'block' } : undefined}
        autoPlay
        muted
        loop
        playsInline
      />
    )
    if (cropTop) {
      return (
        <div className="w-full rounded-2xl overflow-hidden">
          {video}
        </div>
      )
    }
    return video
  }
  return (
    <div
      className={`w-full rounded-2xl flex flex-col items-center justify-center gap-3 ${aspectClass}`}
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
  videoSrc?: string
  badge?: string
  headline: string
  body: ReactNode
}

export function FeatureSection({ flip = false, videoLabel, videoSrc, badge, headline, body }: FeatureSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  const textBlock = (
    <div className="flex flex-col justify-center gap-4">
      {badge && (
        <div className="self-start flex items-center gap-2">
          <span style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '1.15rem', color: 'rgba(255,255,255,0.45)' }}>
            {badge === 'Unleashed' ? 'Workspaces' : badge}
          </span>
          {badge === 'Unleashed' && (
            <span style={{ fontFamily: "'Bangers', cursive", fontSize: '0.875rem', letterSpacing: '0.1em', color: '#39ff14' }}>
              UNLEASHED
            </span>
          )}
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

  const videoBlock = <VideoPlaceholder label={videoLabel} src={videoSrc} />

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
  number: '01' | '02' | '03' | '04' | '05' | '06' | '07'
  flip?: boolean
  headline: string
  body: ReactNode
  videoLabel: string
  videoSrc?: string
  videoImgSrc?: string
  videoNatural?: boolean
  videoCropTop?: number
  badge?: string
}

export function USPSection({ number, flip = false, headline, body, videoLabel, videoSrc, videoImgSrc, videoNatural, videoCropTop, badge }: USPSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  const textBlock = (
    <div className="flex flex-col justify-center gap-5">
      <div className="self-start flex items-baseline gap-3">
        <span
          className="font-bold"
          style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '3.5rem', lineHeight: 1, background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {number}
        </span>
        {badge === 'Unleashed' && (
          <span style={{ fontFamily: "'Bangers', cursive", fontSize: '2rem', letterSpacing: '0.1em', color: '#39ff14', lineHeight: 1 }}>
            UNLEASHED
          </span>
        )}
      </div>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight" style={{ letterSpacing: '-0.02em' }}>
        {headline}
      </h2>
      <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {body}
      </div>
    </div>
  )

  const videoBlock = <VideoPlaceholder label={videoLabel} src={videoSrc} imgSrc={videoImgSrc} natural={videoNatural} cropTop={videoCropTop} />

  return (
    <section
      className="py-20 sm:py-28 px-6"
      style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.04) 0%, transparent 100%)' }}
    >
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        {/* Mobile: number → headline → video → body */}
        <div className="lg:hidden flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="self-start flex items-baseline gap-3">
              <span
                className="font-bold"
                style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '3.5rem', lineHeight: 1, background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                {number}
              </span>
              {badge === 'Unleashed' && (
                <span style={{ fontFamily: "'Bangers', cursive", fontSize: '2rem', letterSpacing: '0.1em', color: '#39ff14', lineHeight: 1 }}>
                  UNLEASHED
                </span>
              )}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {headline}
            </h2>
          </div>
          {videoBlock}
          <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {body}
          </div>
        </div>
        {/* Desktop: side by side with flip */}
        <div className="hidden lg:grid grid-cols-2 gap-20 items-center">
          {flip ? <>{textBlock}{videoBlock}</> : <>{videoBlock}{textBlock}</>}
        </div>
      </div>
    </section>
  )
}

interface SpotlightSectionProps {
  badge?: string
  headline: string
  body: ReactNode
  videoLabel: string
  videoSrc?: string
}

export function SpotlightSection({ badge, headline, body, videoLabel, videoSrc }: SpotlightSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFade(ref)

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          {badge && (
            badge === 'Stash' ? (
              <div className="inline-block mb-6" style={{ fontFamily: 'Bangers, cursive', fontSize: 22, letterSpacing: '0.05em' }}>
                {[
                  { letter: 's', rotate: -4 },
                  { letter: 't', rotate: 3 },
                  { letter: 'a', rotate: -3 },
                  { letter: 's', rotate: 4 },
                  { letter: 'h', rotate: -2 },
                ].map((l, i) => (
                  <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : 1, transform: `rotate(${l.rotate}deg)`, color: '#3b82f6', textShadow: '0 0 8px #3b82f644' }}>
                    {l.letter}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-block mb-6" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '1.15rem', color: 'rgba(255,255,255,0.45)' }}>
                {badge}
              </span>
            )
          )}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
            {headline}
          </h2>
          <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {body}
          </div>
        </div>
        <VideoPlaceholder label={videoLabel} src={videoSrc} natural={!!videoSrc} />
      </div>
    </section>
  )
}
