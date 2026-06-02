import { StrictMode, Component, useState, useEffect } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import ShareViewer from './components/ShareViewer'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { Sentry.captureException(error, { extra: { componentStack: info.componentStack } }) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#666' }}>
          <p>Something went wrong. <a href="/" style={{ color: '#0077cc' }}>Reload</a></p>
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
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
})

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

const shareMatch = window.location.pathname.match(/^\/s\/(w\/)?([^/]+)$/)

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
      {shareMatch ? (
        <ShareViewer token={shareMatch[2]} isWorkspace={shareMatch[1] === 'w/'} />
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
