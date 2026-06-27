import { useEffect, useRef } from 'react'

const USES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: 'Diagramming',
    desc: 'Flowcharts, system designs, ERDs - draw the structure you mean without fighting the tool.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: 'Sketching',
    desc: 'Rough ideas out of your head and onto the screen before they disappear.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: 'Presentations',
    desc: 'Draw live while you talk. Annotate, highlight, and sketch alongside your slides.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Whiteboarding',
    desc: 'A shared surface for thinking out loud - sprint planning, retros, brainstorms.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Note-taking',
    desc: 'Capture handwritten notes, annotate ideas, mix text and diagrams freely.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: 'Creating assets',
    desc: 'Quick icons, UI elements, and illustrations - export clean PNG or SVG when done.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: 'UI mockups',
    desc: 'Wireframe screens and layouts at the speed of thought - before reaching for Figma.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="3" x2="12" y2="9" />
        <line x1="12" y1="15" x2="12" y2="21" />
        <line x1="3" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="8.4" y2="8.4" />
        <line x1="15.6" y1="15.6" x2="18.4" y2="18.4" />
        <line x1="5.6" y1="18.4" x2="8.4" y2="15.6" />
        <line x1="15.6" y1="8.4" x2="18.4" y2="5.6" />
      </svg>
    ),
    title: 'Mind mapping',
    desc: 'Connect ideas with lines and shapes. Let your thinking spread out visually.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: 'Teaching',
    desc: 'Walk through concepts live. Annotate, draw diagrams, highlight what matters.',
  },
]

export function UseCasesSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-block mb-6 font-bold" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '2.5rem', lineHeight: 1, background: 'linear-gradient(135deg, #3b82f6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Use cases
          </div>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold"
            style={{ letterSpacing: '-0.02em' }}
          >
            Whatever you need to make
          </h2>
          <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            One canvas, no limits on what you put on it.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {USES.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl p-6 flex flex-col gap-3 transition-colors duration-200"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(59,130,246,0.06)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
            >
              <div style={{ color: '#93c5fd' }}>{u.icon}</div>
              <h3 className="font-semibold text-base">{u.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
