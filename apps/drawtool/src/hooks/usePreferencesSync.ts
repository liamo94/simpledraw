import { useEffect, useRef, useMemo } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import type { Settings } from './useSettings'
import { createApi, ApiError } from '../lib/api'
import { useTokenReady } from './useTokenReady'

const DEBOUNCE_MS = 800
const DEVICE_INIT_KEY = 'drawtool-settings-initialized'

// Always override local storage on every load — cross-device creative state
const SYNCED_KEYS: (keyof Settings)[] = [
  'lineColor', 'customColor', 'recentColors', 'customThemeBg',
  'lineWidth', 'dashGap',
  'fontFamily', 'textSize', 'textBold', 'textItalic', 'textAlign',
  'activeShape', 'shapeFill', 'shapeFillEnabled', 'shapeDashed', 'shapeCorners', 'fillOpacity',
  'exportFormat', 'exportTransparentBg', 'exportIncludeImages',
]

// Only seed a fresh device — localStorage wins once set
const PREF_KEYS: (keyof Settings)[] = [
  'theme', 'gridType', 'pressureSensitivity',
  'showZoomControls', 'showTips', 'showSelectControls', 'confirmClear',
  'leftClickTool', 'rightClickTool', 'unleashedMenuIcon',
]

type StoredPrefs = { synced?: Partial<Settings>; prefs?: Partial<Settings> }

function pick(obj: Partial<Settings>, keys: (keyof Settings)[]): Partial<Settings> {
  const out: Partial<Settings> = {}
  for (const k of keys) {
    if (k in obj) (out as Record<string, unknown>)[k] = (obj as Record<string, unknown>)[k]
  }
  return out
}

export function usePreferencesSync(
  settings: Settings,
  updateSettings: (partial: Partial<Settings>) => void,
) {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()

  const api = useMemo(() => createApi(getToken), [getToken])
  const tokenReady = useTokenReady()

  const readyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Settings | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  function buildPayload(s: Settings): StoredPrefs {
    return { synced: pick(s, SYNCED_KEYS), prefs: pick(s, PREF_KEYS) }
  }

  async function putPreferences(s: Settings) {
    await api.put<void>('/preferences', buildPayload(s))
  }

  // Fetch on sign-in, but only once the Clerk token is available.
  useEffect(() => {
    if (!isSignedIn || !tokenReady) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      pendingRef.current = null
      readyRef.current = false
      return
    }

    readyRef.current = false

    api.get<StoredPrefs | Partial<Settings> | null>('/preferences')
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      })
      .then((raw: StoredPrefs | Partial<Settings> | null) => {
        const isNewDevice = !localStorage.getItem(DEVICE_INIT_KEY)
        localStorage.setItem(DEVICE_INIT_KEY, '1')

        if (raw && typeof raw === 'object') {
          const isNewFormat = 'synced' in raw || 'prefs' in raw

          if (isNewFormat) {
            const stored = raw as StoredPrefs
            const toApply: Partial<Settings> = {}
            if (stored.synced) Object.assign(toApply, pick(stored.synced as Partial<Settings>, SYNCED_KEYS))
            if (isNewDevice && stored.prefs) Object.assign(toApply, pick(stored.prefs as Partial<Settings>, PREF_KEYS))
            if (Object.keys(toApply).length > 0) updateSettings(toApply)
          } else {
            // Legacy flat format — treat all as pref, seed new devices only
            const legacy = raw as Partial<Settings>
            if (isNewDevice) {
              const toApply = pick(legacy, [...SYNCED_KEYS, ...PREF_KEYS])
              if (Object.keys(toApply).length > 0) updateSettings(toApply)
            }
            // Migrate to new format immediately
            putPreferences(settingsRef.current).catch(() => {})
          }
        } else {
          // No cloud prefs yet — push local settings so future devices get them
          putPreferences(settingsRef.current).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => { readyRef.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, tokenReady])

  // Debounce PUT on settings change (after initial fetch)
  useEffect(() => {
    if (!isSignedIn || !readyRef.current) return

    pendingRef.current = settings
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      timerRef.current = null
      const s = pendingRef.current
      pendingRef.current = null
      if (!s) return
      try { await putPreferences(s) } catch { /* ignore */ }
    }, DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, isSignedIn])
}
