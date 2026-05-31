import { StrictMode, Component } from 'react'
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

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [],
  tracesSampleRate: 0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
})

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: Infinity },
  },
})

// /s/:token  — canvas share
// /s/w/:token — workspace share
const shareMatch = window.location.pathname.match(/^\/s\/(w\/)?([^/]+)$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{
          variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#1a1a2e',
            colorText: '#ffffff',
            colorTextSecondary: 'rgba(255,255,255,0.5)',
            colorInputBackground: 'rgba(255,255,255,0.06)',
            colorInputText: '#ffffff',
            borderRadius: '10px',
          },
        }}>
          {shareMatch ? (
            <ShareViewer
              token={shareMatch[2]}
              isWorkspace={shareMatch[1] === 'w/'}
            />
          ) : (
            <App />
          )}
        </ClerkProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
