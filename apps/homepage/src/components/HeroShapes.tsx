// Decorative floating shapes around the hero — conveys "canvas app" immediately.
// All drawn with inline SVG, no assets needed.

const rc = 'round' as const

// 5-pointed star polygon points, cx/cy = centre, r1 = outer, r2 = inner
function starPoints(cx: number, cy: number, r1: number, r2: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const r = i % 2 === 0 ? r1 : r2
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

export function HeroShapes() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden>
      {/* ── Filled pink circle ── small ──────────── top-right ── */}
      <div className="hidden sm:block float absolute" style={{ top: '14%', right: '7%', animationDelay: '0s', animationDuration: '4s' }}>
        <svg width="36" height="36" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="21" fill="rgba(236,72,153,0.75)" />
        </svg>
      </div>

      {/* ── Outlined blue rectangle ── medium ────── top-left ── */}
      <div className="hidden sm:block float absolute" style={{ top: '12%', left: '5%', animationDelay: '1.1s', animationDuration: '5s', transform: 'rotate(-8deg)' }}>
        <svg width="80" height="58" viewBox="0 0 64 46">
          <rect x="3" y="3" width="58" height="40" rx="3" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin={rc} />
        </svg>
      </div>

      {/* ── Done checkbox ── large ──────────────── upper-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '26%', left: '3%', animationDelay: '1.6s', animationDuration: '5.1s', transform: 'rotate(-6deg)' }}>
        <img src="/hero-done.png" alt="" width={120} height={67} style={{ display: 'block' }} />
      </div>

      {/* ── Filled orange star ── small ──────────── mid-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '38%', left: '3%', animationDelay: '0.5s', animationDuration: '5.5s', transform: 'rotate(12deg)' }}>
        <svg width="38" height="38" viewBox="0 0 54 54">
          <polygon points={starPoints(27, 27, 24, 10)} fill="#f97316" />
        </svg>
      </div>

      {/* ── Purple filled diamond ── small ─────── lower-left ── */}
      <div className="hidden sm:block float absolute" style={{ top: '65%', left: '5%', animationDelay: '2s', animationDuration: '4.5s', transform: 'rotate(5deg)' }}>
        <svg width="34" height="40" viewBox="0 0 46 54">
          <polygon points="23,2 44,27 23,52 2,27" fill="rgba(139,92,246,0.8)" />
        </svg>
      </div>

      {/* ── Dashed cyan circle ── large ─────── lower-left further ── */}
      <div className="hidden lg:block float absolute" style={{ top: '72%', left: '13%', animationDelay: '0.3s', animationDuration: '6s', transform: 'rotate(-5deg)' }}>
        <svg width="80" height="80" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#06b6d4" strokeWidth="3" strokeDasharray="5 4" strokeLinecap={rc} />
        </svg>
      </div>

      {/* ── Green filled triangle ── small ──── upper-right area ── */}
      <div className="hidden lg:block float absolute" style={{ top: '20%', right: '14%', animationDelay: '1.7s', animationDuration: '4.8s', transform: 'rotate(-10deg)' }}>
        <svg width="38" height="35" viewBox="0 0 52 48">
          <polygon points="26,3 50,45 2,45" fill="rgba(34,197,94,0.8)" />
        </svg>
      </div>

      {/* ── Yellow cloud outline ── large ────────── mid-right ── */}
      <div className="hidden sm:block float absolute" style={{ top: '47%', right: '4%', animationDelay: '0.9s', animationDuration: '5.2s', transform: 'rotate(4deg)' }}>
        <svg width="100" height="67" viewBox="0 0 72 48">
          <path
            d="M14,38 Q6,38 6,30 Q6,22 14,21 Q13,10 22,9 Q28,4 36,8 Q43,3 50,8 Q58,6 61,14 Q68,14 68,22 Q68,30 61,30 Q62,38 54,38 Z"
            fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinejoin={rc} strokeLinecap={rc}
          />
        </svg>
      </div>

      {/* ── Real canvas export: blue curved arrow ── large ── lower-right ── */}
      <div className="hidden sm:block float absolute" style={{ top: '65%', right: '6%', animationDelay: '1.4s', animationDuration: '4.2s', transform: 'rotate(-15deg)' }}>
        <img src="/hero-arrow.png" alt="" width={80} height={109} style={{ display: 'block' }} />
      </div>

      {/* ── Laser pointer trail ── small ──────────── upper area ── */}
      <div className="hidden lg:block float absolute" style={{ top: '30%', right: '9%', animationDelay: '2.5s', animationDuration: '6s' }}>
        <svg width="56" height="35" viewBox="0 0 80 50" style={{ filter: 'drop-shadow(0 0 6px rgba(251,113,133,0.9)) drop-shadow(0 0 14px rgba(251,113,133,0.5))' }}>
          <path d="M4,42 C14,38 18,12 28,16 C38,20 36,36 48,28 C58,22 62,8 76,10" fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinecap={rc} />
          <circle cx="4" cy="42" r="3" fill="#fb7185" />
        </svg>
      </div>

      {/* ── Pink freehand squiggle ── medium ──────── mid-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '55%', left: '8%', animationDelay: '3s', animationDuration: '5.8s', transform: 'rotate(6deg)' }}>
        <svg width="90" height="46" viewBox="0 0 70 36">
          <path d="M4,28 C10,8 18,32 28,18 C36,6 44,30 54,16 C60,8 64,22 68,18" fill="none" stroke="rgba(236,72,153,0.7)" strokeWidth="3" strokeLinecap={rc} />
        </svg>
      </div>

      {/* ── Green crosshatch cloud ── large ──── top-right further ── */}
      <div className="hidden lg:block float absolute" style={{ top: '8%', right: '18%', animationDelay: '0.7s', animationDuration: '4.6s', transform: 'rotate(20deg)' }}>
        <img src="/hero-cloud.png" alt="" width={100} height={95} style={{ display: 'block' }} />
      </div>

      {/* ── Outlined purple star ── medium ──────── lower-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '78%', right: '12%', animationDelay: '1.9s', animationDuration: '5.4s', transform: 'rotate(-8deg)' }}>
        <svg width="64" height="64" viewBox="0 0 48 48">
          <polygon points={starPoints(24, 24, 22, 9)} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin={rc} />
        </svg>
      </div>

      {/* ── Dashed orange rect ── small ──────────── lower-left ── */}
      <div className="hidden sm:block float absolute" style={{ top: '80%', left: '18%', animationDelay: '2.3s', animationDuration: '4.9s', transform: 'rotate(10deg)' }}>
        <svg width="42" height="32" viewBox="0 0 56 42">
          <rect x="3" y="3" width="50" height="36" rx="4" fill="none" stroke="#f97316" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin={rc} />
        </svg>
      </div>
    </div>
  )
}
