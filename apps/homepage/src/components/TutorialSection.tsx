import { useEffect, useRef } from 'react'
import { DRAW_URL } from './Logo'

const CHALLENGES = [
  'Freehand & dashed strokes', 'Highlight & spray', 'Laser pointer',
  'Pan & zoom', 'Multiple canvases', 'Undo & erase',
  'Themes & grids', 'Shapes & fills', 'Text & fonts',
]

export function TutorialSection() {
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
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div
          className="rounded-3xl p-10 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <div
              className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-5"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              Interactive tutorial
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.01em' }}>
              Up to speed in minutes
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              The built-in tutorial walks you through every tool and shortcut with hands-on challenges. No reading required - just draw.
            </p>
            <a
              href={`${DRAW_URL}/training`}
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)', color: '#fff' }}
            >
              Start the tutorial →
            </a>
            <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Also press <kbd className="kbd">?</kbd> any time inside drawzilla to see the full shortcuts reference.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {CHALLENGES.map((c, i) => (
              <div
                key={c}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)' }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}
                >
                  {i + 1}
                </span>
                {c}
              </div>
            ))}
            <p className="text-xs mt-1 px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              + more challenges covering every feature
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
