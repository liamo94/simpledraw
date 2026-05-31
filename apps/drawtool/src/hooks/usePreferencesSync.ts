import { useEffect, useRef, useMemo } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import type { Settings } from './useSettings'
import { createApi, ApiError } from '../lib/api'

const DEBOUNCE_MS = 800

export function usePreferencesSync(
  settings: Settings,
  updateSettings: (partial: Partial<Settings>) => void,
) {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()

  const api = useMemo(() => createApi(getToken), [getToken])

  // True once the initial fetch from backend has settled
  const readyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Settings | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  async function putPreferences(prefs: Settings) {
    await api.put<void>('/preferences', prefs)
  }

  // On sign-in: fetch preferences from backend and apply them.
  // If cloud has no prefs yet, push local settings immediately so future sign-ins restore them.
  useEffect(() => {
    if (!isSignedIn) {
      // Sign-out: cancel pending debounce and flush immediately while token may still be valid
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      const prefs = pendingRef.current
      pendingRef.current = null
      readyRef.current = false
      if (prefs) putPreferences(prefs).catch(() => {})
      return
    }

    readyRef.current = false

    api.get<Partial<Settings> | null>('/preferences')
      .catch((err: unknown) => {
        // 404 means no prefs yet — treat as null
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      })
      .then((prefs: Partial<Settings> | null) => {
        if (prefs && typeof prefs === 'object') {
          updateSettings(prefs)
        } else {
          // No cloud prefs yet — push current local settings so next sign-in restores them
          putPreferences(settingsRef.current).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => { readyRef.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn])

  // On settings change: debounce a PUT to backend
  useEffect(() => {
    if (!isSignedIn || !readyRef.current) return

    pendingRef.current = settings
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      timerRef.current = null
      const prefs = pendingRef.current
      pendingRef.current = null
      if (!prefs) return
      try { await putPreferences(prefs) } catch { /* ignore */ }
    }, DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, isSignedIn])
}
