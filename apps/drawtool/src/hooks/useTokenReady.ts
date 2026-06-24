import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'

// Clerk sets isSignedIn=true before obtaining the JWT — getToken() returns null
// for a brief window. This hook polls until we have a token, then returns true,
// preventing queries from firing (and hitting 401) during that window.
export function useTokenReady(): boolean {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isSignedIn) { setReady(false); return }
    let cancelled = false
    ;(async () => {
      while (!cancelled) {
        const token = await getToken()
        if (cancelled) return
        if (token) { setReady(true); return }
        await new Promise<void>(r => setTimeout(r, 50))
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn, getToken])

  return ready
}
