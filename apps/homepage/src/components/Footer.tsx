import { DRAW_URL } from './Logo'

export function Footer() {
  return (
    <footer
      className="px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
      style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span>© 2026 <a href="https://liamo.co" className="hover:text-white transition-colors">liamo.co</a></span>
      <div className="flex items-center gap-5">
        <a href="https://unleash.drawzil.la/privacy" className="hover:text-white transition-colors">Privacy</a>
        <a href="https://unleash.drawzil.la/terms" className="hover:text-white transition-colors">Terms</a>
        <a href={DRAW_URL} className="hover:text-white transition-colors">drawzil.la</a>
      </div>
    </footer>
  )
}
