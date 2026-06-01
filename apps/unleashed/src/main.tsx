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

const clerkAppearance = {
  variables: {
    colorPrimary: '#39ff14',
    colorBackground: '#0d0d1a',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255,255,255,0.5)',
    colorInputBackground: 'rgba(255,255,255,0.06)',
    colorInputText: '#ffffff',
    colorInputPlaceholder: 'rgba(255,255,255,0.3)',
    borderRadius: '10px',
  },
  elements: {
    formButtonPrimary: { color: '#000000', fontWeight: '600' },
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderColor: 'rgba(255,255,255,0.15)',
    },
    socialButtonsBlockButtonText: { color: '#ffffff' },
    socialButtonsBlockButtonArrow: { color: '#ffffff' },
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {needsClerk ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    ) : (
      <Page />
    )}
  </StrictMode>,
)
