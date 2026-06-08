import { DRAW_URL } from './Logo'
import { VideoPlaceholder } from './FeatureSection'
import { HeroShapes } from './HeroShapes'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 60%)',
      }} />
      <HeroShapes />

      <div className="relative max-w-3xl mx-auto">
        <img
          src="/mascot-normal.png"
          alt=""
          className="float mx-auto mb-6"
          style={{
            width: 160,
            height: 160,
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 32px rgba(59,130,246,0.35))',
          }}
        />

        <div
          className="inline-block text-xs font-semibold tracking-widest uppercase mb-6 px-3 py-1 rounded-full"
          style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
        >
          Free to use · No account needed
        </div>

        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          style={{ letterSpacing: '-0.02em' }}
        >
          Fun, fast and{' '}
          <span style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            powerful
          </span>{' '}
          canvas tool
        </h1>

        <p className="text-lg sm:text-xl mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
          An infinite canvas where shortcuts do the heavy lifting, whether you're sketching ideas, annotating, or creating art.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={DRAW_URL}
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-full transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)', color: '#fff' }}
          >
            Try it free →
          </a>
          <a
            href={`${DRAW_URL}/training`}
            className="inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-full transition-all duration-200 hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Interactive tutorial
          </a>
        </div>
      </div>

      <div className="relative mt-16 w-full max-w-5xl mx-auto">
        <img
          src="/hero-jag.png"
          alt=""
          width={130}
          height={130}
          className="hidden lg:block absolute pointer-events-none"
          style={{ left: '-160px', top: '50%', transform: 'translateY(-50%) rotate(-15deg)' }}
        />
        <img
          src="/hero-love-drawzilla.png"
          alt=""
          width={210}
          height={80}
          className="hidden lg:block absolute pointer-events-none"
          style={{ left: '-218px', bottom: '-20px', transform: 'rotate(-6deg)' }}
        />
        <VideoPlaceholder label="VIDEO: general drawzilla demo - freehand drawing, shapes, theme switching, keyboard shortcuts, stash" tall src="/hero.mp4" />
      </div>
    </section>
  )
}
