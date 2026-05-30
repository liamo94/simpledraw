import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import Privacy from './Privacy'
import Terms from './Terms'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')

const queryClient = new QueryClient()

const path = window.location.pathname
let Page: React.ComponentType

if (path === '/privacy') {
  Page = Privacy
} else if (path === '/terms') {
  Page = Terms
} else {
  Page = App
}

const needsClerk = Page === App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {needsClerk ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    ) : (
      <Page />
    )}
  </StrictMode>,
)
