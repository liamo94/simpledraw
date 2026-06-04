import { useEffect, useState } from 'react'
import { DrawzillaLogo, DRAW_URL } from './Logo'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(6,6,15,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <DrawzillaLogo iconSize={32} fontSize="1.4rem" />
      <a
        href={DRAW_URL}
        className="text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)', color: '#fff' }}
      >
        Open drawzilla →
      </a>
    </nav>
  )
}
