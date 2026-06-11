import { StrictMode, Component, useState, useEffect, lazy, Suspense } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import './index.css'
import App from './App'
const ShareViewer = lazy(() => import('./components/ShareViewer'))
import DrawzillaLogo from './components/DrawzillaLogo'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { Sentry.captureException(error, { extra: { componentStack: info.componentStack } }) }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#fff', gap: 0,
          padding: 32, textAlign: 'center',
        }}>
          <img src="/drawzillaicon.svg" width={56} height={56} style={{ marginBottom: 20, opacity: 0.9 }} alt="drawzilla" />
          <div style={{ marginBottom: 8, userSelect: 'none' }}>
            <DrawzillaLogo fontSize={28} isDark={true} />
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>Something went wrong.</div>
          <a href="/" style={{
            display: 'inline-block', padding: '8px 20px', borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none', fontSize: 13, border: '1px solid rgba(255,255,255,0.1)',
          }}>Reload</a>
        </div>
      )
    }
    return this.props.children
  }
}

// Prevent browser-level pinch-to-zoom (iOS Safari ignores user-scalable=no)
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false })

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [],
  tracesSampleRate: 0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD,
})

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/ph`,
    ui_host: 'https://eu.posthog.com',
    persistence: 'localStorage+cookie',
    disable_cookie: true,
    capture_dead_clicks: false,
  })
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')

const DARK_THEMES = new Set(['dark', 'midnight', 'lumber', 'slate'])
const BG_MAP: Record<string, string> = {
  dark: '#06060e', midnight: '#15152a', lumber: '#141404', slate: '#1c2128',
  journal: '#fffce0', sky: '#eaf4fb', sand: '#f5ede8', white: '#f5f5f0',
}

function clerkVarsForTheme(theme: string) {
  const isDark = DARK_THEMES.has(theme)
  const bg = BG_MAP[theme] ?? '#06060e'
  return {
    colorBackground: bg,
    colorText: isDark ? '#ffffff' : '#1a1a1a',
    colorTextSecondary: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    colorInputBackground: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    colorInputText: isDark ? '#ffffff' : '#1a1a1a',
  }
}

function clerkElementsForTheme(theme: string) {
  if (!DARK_THEMES.has(theme)) return {}
  return {
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderColor: 'rgba(255,255,255,0.15)',
    },
    socialButtonsBlockButtonText: { color: '#ffffff' },
    socialButtonsBlockButtonArrow: { color: '#ffffff' },
  }
}

function readTheme(): string {
  try { return JSON.parse(localStorage.getItem('drawtool-settings') ?? '{}').theme ?? 'dark' }
  catch { return 'dark' }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: Infinity },
  },
})

const shareMatch = window.location.pathname.match(/^\/s\/(w\/|p\/)?([^/]+)$/)
const embedMatch = window.location.pathname.match(/^\/embed\/([^/]+)$/)

function ClerkRoot() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const handler = (e: Event) => setTheme((e as CustomEvent<string>).detail)
    window.addEventListener('drawtool:themechange', handler)
    return () => window.removeEventListener('drawtool:themechange', handler)
  }, [])

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{
      variables: { colorPrimary: '#3b82f6', borderRadius: '10px', ...clerkVarsForTheme(theme) },
      elements: clerkElementsForTheme(theme),
    }}>
      {embedMatch ? (
        <Suspense fallback={null}>
          <ShareViewer token={embedMatch[1]} isWorkspace={false} embedded />
        </Suspense>
      ) : shareMatch ? (
        <Suspense fallback={null}>
          <ShareViewer token={shareMatch[2]} isWorkspace={shareMatch[1] === 'w/'} isPresentation={shareMatch[1] === 'p/'} />
        </Suspense>
      ) : (
        <App />
      )}
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkRoot />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
