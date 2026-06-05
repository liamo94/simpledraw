import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { StashItem } from '../canvas/types'
import { saveStash } from '../canvas/storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

type Options = {
  items: StashItem[]
  isPro: boolean
  isSignedIn: boolean | undefined
  onCloudLoad: (items: StashItem[]) => void
}

export function useCloudStash({ items, isPro, isSignedIn, onCloudLoad }: Options) {
  const { getToken } = useAuth()
  const cloudLoadedRef = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Capture latest items in a ref so the async cloud-load closure sees current local stash
  const itemsRef = useRef(items)
  itemsRef.current = items

  // On mount for Pro users: sync cloud ↔ local
  // - Cloud has data → use cloud (covers new device login)
  // - Cloud is empty → upload local to cloud (covers new Pro upgrade)
  useEffect(() => {
    if (!isSignedIn) { cloudLoadedRef.current = false; return }
    if (!isPro || cloudLoadedRef.current) return
    cloudLoadedRef.current = true
    ;(async () => {
      const token = await getToken()
      if (!token) return
      try {
        const res = await fetch(`${API_URL}/stash`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const cloud: StashItem[] = await res.json()
        if (cloud.length > 0) {
          // Cloud wins - replace local (e.g. signing in on a new device)
          onCloudLoad(cloud)
          saveStash(cloud)
        } else if (itemsRef.current.length > 0) {
          // Cloud is empty, local has data - upload local (e.g. just upgraded to Pro)
          await fetch(`${API_URL}/stash`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(itemsRef.current),
          })
        }
      } catch {}
    })()
  }, [isPro, isSignedIn])

  // Debounced PUT to cloud whenever items change (Pro only, after initial load)
  useEffect(() => {
    if (!isPro || !isSignedIn || !cloudLoadedRef.current) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(async () => {
      const token = await getToken()
      if (!token) return
      try {
        await fetch(`${API_URL}/stash`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(items),
        })
      } catch {}
    }, 1500)
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [items, isPro, isSignedIn])
}
