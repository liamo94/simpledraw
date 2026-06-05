// Decorative floating shapes around the hero - conveys "canvas app" immediately.
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
      {/* ── Circle canvas export ── small ──────────── top-right ── */}
      <div className="hidden sm:block float absolute" style={{ top: '8%', right: '7%', animationDelay: '0s', animationDuration: '4s' }}>
        <img src="/hero-circle.png" alt="" width={70} height={70} style={{ display: 'block' }} />
      </div>

      {/* ── "canvas app" text export ── medium ────── top-left ── */}
      <div className="hidden sm:block float absolute" style={{ top: '12%', left: '3%', animationDelay: '1.1s', animationDuration: '5s', transform: 'rotate(-8deg)' }}>
        <img src="/hero-canvas-app.png" alt="" width={130} height={50} style={{ display: 'block' }} />
      </div>

      {/* ── Done checkbox ── large ──────────────── upper-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '26%', left: '3%', animationDelay: '1.6s', animationDuration: '5.1s', transform: 'rotate(-6deg)' }}>
        <img src="/hero-done.png" alt="" width={120} height={67} style={{ display: 'block' }} />
      </div>


      {/* ── Diamond canvas export ── medium ─────── mid-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '44%', left: '18%', animationDelay: '2s', animationDuration: '4.5s', transform: 'rotate(5deg)' }}>
        <img src="/hero-diamond.png" alt="" width={90} height={100} style={{ display: 'block' }} />
      </div>

      {/* ── A/B circles canvas export ── large ─────── upper-left mid ── */}
      <div className="hidden lg:block float absolute" style={{ top: '8%', left: '20%', animationDelay: '0.3s', animationDuration: '6s', transform: 'rotate(-5deg)' }}>
        <img src="/hero-ab.png" alt="" width={120} height={60} style={{ display: 'block' }} />
      </div>

      {/* ── Overlapping filled shapes canvas export ── large ── upper-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '18%', right: '3%', animationDelay: '1.7s', animationDuration: '4.8s', transform: 'rotate(-10deg)' }}>
        <img src="/hero-shapes-overlap.png" alt="" width={110} height={110} style={{ display: 'block' }} />
      </div>


      {/* ── Star with dashed arrow ── large ── mid-left further ── */}
      <div className="hidden lg:block float absolute" style={{ top: '54%', left: '4%', animationDelay: '2.2s', animationDuration: '5.6s', transform: 'rotate(-8deg)' }}>
        <img src="/hero-star-arrow.png" alt="" width={110} height={110} style={{ display: 'block' }} />
      </div>

      {/* ── Real canvas export: blue curved arrow ── large ── lower-right ── */}
      <div className="hidden sm:block float absolute" style={{ top: '60%', right: '6%', animationDelay: '1.4s', animationDuration: '4.2s', transform: 'rotate(-15deg)' }}>
        <img src="/hero-arrow.png" alt="" width={80} height={109} style={{ display: 'block' }} />
      </div>

      {/* ── Sticky note canvas export ── medium ──────── mid-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '33%', right: '8%', animationDelay: '2.5s', animationDuration: '6s', transform: 'rotate(5deg)' }}>
        <img src="/hero-sticky-note.png" alt="" width={100} height={100} style={{ display: 'block' }} />
      </div>

      {/* ── Spray dots canvas export ── medium ──────── mid-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '44%', right: '3%', animationDelay: '3s', animationDuration: '5.8s', transform: 'rotate(6deg)' }}>
        <img src="/hero-spray.png" alt="" width={150} height={150} style={{ display: 'block' }} />
      </div>

      {/* ── Green crosshatch cloud ── large ──── top-right further ── */}
      <div className="hidden lg:block float absolute" style={{ top: '8%', right: '18%', animationDelay: '0.7s', animationDuration: '4.6s', transform: 'rotate(20deg)' }}>
        <img src="/hero-cloud.png" alt="" width={110} height={90} style={{ display: 'block' }} />
      </div>

      {/* ── DB canvas export ── medium ──────── mid-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '90%', right: '6%', animationDelay: '1.9s', animationDuration: '5.4s', transform: 'rotate(-8deg)' }}>
        <img src="/hero-db.png" alt="" width={90} height={90} style={{ display: 'block' }} />
      </div>

      {/* ── Bar chart canvas export ── medium ──────── lower-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '37%', left: '2%', animationDelay: '2.3s', animationDuration: '4.9s', transform: 'rotate(10deg)' }}>
        <img src="/hero-bar-chart.png" alt="" width={130} height={50} style={{ display: 'block' }} />
      </div>

      {/* ── Rainbow prism strokes ── medium ─────── lower-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '76%', right: '2%', animationDelay: '1.3s', animationDuration: '5.3s', transform: 'rotate(-4deg)' }}>
        <img src="/hero-prism.png" alt="" width={140} height={55} style={{ display: 'block' }} />
      </div>
    </div>
  )
}
