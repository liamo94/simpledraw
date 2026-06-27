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
      <div className="hidden sm:block float absolute" style={{ top: '6%', right: '7%', animationDelay: '0s', animationDuration: '4s' }}>
        <img src="/hero-circle.png" alt="" width={70} height={70} style={{ display: 'block' }} />
      </div>

      {/* ── A/B circles canvas export ── large ─────── upper-left mid ── */}
      <div className="hidden lg:block float absolute" style={{ top: '10%', left: '20%', animationDelay: '0.3s', animationDuration: '6s', transform: 'rotate(-5deg)' }}>
        <img src="/hero-ab.png" alt="" width={120} height={60} style={{ display: 'block' }} />
      </div>

      {/* ── Green crosshatch cloud ── large ──── upper-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '14%', right: '18%', animationDelay: '0.7s', animationDuration: '4.6s', transform: 'rotate(20deg)' }}>
        <img src="/hero-cloud.png" alt="" width={110} height={90} style={{ display: 'block' }} />
      </div>

      {/* ── "canvas app" text export ── medium ────── top-left ── */}
      <div className="hidden sm:block float absolute" style={{ top: '18%', left: '3%', animationDelay: '1.1s', animationDuration: '5s', transform: 'rotate(-8deg)' }}>
        <img src="/hero-canvas-app.png" alt="" width={130} height={50} style={{ display: 'block' }} />
      </div>

      {/* ── Overlapping filled shapes canvas export ── large ── upper-right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '22%', right: '3%', animationDelay: '1.7s', animationDuration: '4.8s', transform: 'rotate(-10deg)' }}>
        <img src="/hero-shapes-overlap.png" alt="" width={110} height={110} style={{ display: 'block' }} />
      </div>

      {/* ── Done checkbox ── large ──────────────── left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '26%', left: '3%', animationDelay: '1.6s', animationDuration: '5.1s', transform: 'rotate(-6deg)' }}>
        <img src="/hero-done.png" alt="" width={120} height={67} style={{ display: 'block' }} />
      </div>

      {/* ── Sticky note canvas export ── medium ──────── right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '30%', right: '8%', animationDelay: '2.5s', animationDuration: '6s', transform: 'rotate(5deg)' }}>
        <img src="/hero-sticky-note.png" alt="" width={100} height={100} style={{ display: 'block' }} />
      </div>

      {/* ── Bar chart canvas export ── medium ──────── left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '34%', left: '2%', animationDelay: '2.3s', animationDuration: '4.9s', transform: 'rotate(10deg)' }}>
        <img src="/hero-bar-chart.png" alt="" width={130} height={50} style={{ display: 'block' }} />
      </div>

      {/* ── Diamond canvas export ── medium ─────── mid-left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '38%', left: '18%', animationDelay: '2s', animationDuration: '4.5s', transform: 'rotate(5deg)' }}>
        <img src="/hero-diamond.png" alt="" width={90} height={100} style={{ display: 'block' }} />
      </div>

      {/* ── Spray dots canvas export ── medium ──────── right ── */}
      <div className="hidden lg:block float absolute" style={{ top: '42%', right: '3%', animationDelay: '3s', animationDuration: '5.8s', transform: 'rotate(6deg)' }}>
        <img src="/hero-spray.png" alt="" width={150} height={150} style={{ display: 'block' }} />
      </div>

      {/* ── Star with dashed arrow ── large ── left ── */}
      <div className="hidden lg:block float absolute" style={{ top: '47%', left: '4%', animationDelay: '2.2s', animationDuration: '5.6s', transform: 'rotate(-8deg)' }}>
        <img src="/hero-star-arrow.png" alt="" width={110} height={110} style={{ display: 'block' }} />
      </div>
    </div>
  )
}
