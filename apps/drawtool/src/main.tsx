import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import ShareViewer from './components/ShareViewer'

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
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
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
  </StrictMode>,
)
