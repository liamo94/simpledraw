import { useEffect, useRef } from 'react'

const UNLEASHED_URL = 'https://unleash.drawzil.la'

const PERKS = [
  'Full cloud sync',
  'Unlock all canvases',
  'Workspaces',
  'Live share links',
  'Clean PNG & SVG exports',
  'Priority support',
]

export function UnleashedBanner() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-20 sm:py-28 px-6">
      <div
        ref={ref}
        className="scroll-fade max-w-4xl mx-auto rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(57,255,20,0.08) 0%, rgba(6,6,15,0.6) 50%, rgba(57,255,20,0.05) 100%)',
          border: '1px solid rgba(57,255,20,0.2)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(57,255,20,0.07) 0%, transparent 70%)' }}
        />

        <div className="relative">
          <div className="mb-6 flex flex-col items-center gap-4">
            <img src="/unleashed-icon.png" alt="Unleashed" width={80} height={80} style={{ objectFit: 'contain' }} />
            <span style={{
              fontFamily: "'Bangers', cursive",
              fontSize: '2rem',
              letterSpacing: '0.1em',
              color: '#39ff14',
              textShadow: '0 1px 3px rgba(0,0,0,0.5), 0 -4px 8px rgba(57,255,20,0.75), 0 -10px 18px rgba(57,255,20,0.4), 0 -20px 28px rgba(30,160,0,0.16)',
            }}>
              UNLEASHED
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Take it further
          </h2>
          <p className="text-base sm:text-lg mb-8 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Upgrade to Unleashed for cloud sync, unlimited workspaces, share links, and clean exports - no watermark.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {PERKS.map(p => (
              <span
                key={p}
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: 'rgba(57,255,20,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(57,255,20,0.15)' }}
              >
                ✓ {p}
              </span>
            ))}
          </div>

          <a
            href={UNLEASHED_URL}
            className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3 rounded-full transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95"
            style={{ background: '#39ff14', color: '#06060f' }}
          >
            Learn about Unleashed →
          </a>
        </div>
      </div>
    </section>
  )
}
