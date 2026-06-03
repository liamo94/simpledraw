import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadStrokes, loadView, saveStrokes, saveView, setSaveHook } from '../canvas/storage'
import { getImageDataUrl, getImageDataUrlFromIdb, storeImage } from '../canvas/imageStore'
import type { Stroke } from '../canvas/types'
import { generateCanvasThumbnail } from '../canvas/rendering'
import { createApi } from '../lib/api'
import { useCloudSessionStore } from '../stores/cloudSessionStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const SAVE_DEBOUNCE_MS = 300
const CLOUD_SLOT = 1
// Tracks which canvas has local changes not yet confirmed by the server.
// Survives page reloads so we can skip overwriting localStorage with stale server data.
const DIRTY_KEY = 'drawtool-cloud-dirty'

export type CloudCanvasMeta = {
  id: string
  name: string
  position: number
  updated_at: number
  is_empty: number   // 1 = never saved, 0 = has content (set by backend on PUT/migrate)
  stroke_count: number
  share_token: string | null
  share_enabled: number
}

export type ShareLink = {
  token: string
  type: 'frozen' | 'live'
  expires_at: number | null
  created_at: number
}

export type CloudWorkspace = {
  id: string
  name: string
  share_token: string | null
  share_enabled: number
  is_pinned: number
  is_favourite: number
  canvases: CloudCanvasMeta[]
}

function swapStrokeColors(strokes: Stroke[]): Stroke[] {
  const swap = (c: string) => c === '#000000' ? '#ffffff' : c === '#ffffff' ? '#000000' : c
  return strokes.map(s => ({
    ...s,
    color: swap(s.color),
    subStrokes: s.subStrokes ? swapStrokeColors(s.subStrokes as Stroke[]) : undefined,
  }))
}

function storeThumbnail(id: string, strokes: Stroke[], isDark: boolean) {
  // Defer to idle time — thumbnail generation (renderStrokesToCtx + JPEG encode) is
  // expensive on the main thread and can drop frames if it fires mid-draw.
  const run = () => {
    const url = generateCanvasThumbnail(strokes, isDark)
    if (url) localStorage.setItem(`drawtool-thumb-${id}`, url)
    else localStorage.removeItem(`drawtool-thumb-${id}`)
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 100)
  }
}

function imageIds(strokes: Stroke[]): string[] {
  return [...new Set(strokes.flatMap(s => s.imageId ? [s.imageId] : []))]
}

async function collectImages(strokes: Stroke[]): Promise<Record<string, string>> {
  const ids = imageIds(strokes)
  if (ids.length === 0) return {}
  const images: Record<string, string> = {}
  await Promise.all(ids.map(async id => {
    const url = await getImageDataUrlFromIdb(id)
    if (url) images[id] = url
  }))
  return images
}

function collectImagesSync(strokes: Stroke[]): Record<string, string> {
  const images: Record<string, string> = {}
  for (const id of imageIds(strokes)) {
    const url = getImageDataUrl(id)
    if (url) images[id] = url
  }
  return images
}

function imagePayload(images: Record<string, string>): { images: Record<string, string> } | Record<string, never> {
  return Object.keys(images).length > 0 ? { images } : {}
}

export function useCloudCanvas(isDark: boolean, canvasLimit: number = 3, planLoading: boolean = false, isPro: boolean = false, preferredCanvasId?: string, newRoute: boolean = false) {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark
  const queryClient = useQueryClient()

  const {
    activeId,
    activeWorkspaceId,
    cachedWorkspaceName,
    cachedCanvasName,
    loadKey,
    clearKey,
    setActiveCanvas,
    setActiveWorkspace,
    setCachedCanvasName,
    bumpLoadKey,
    bumpClearKey,
    markUpdatedAt,
    getUpdatedAt,
    setCloudPrefApplied,
    setSlot1BackedUp,
    setProvisioning,
    resetSession,
  } = useCloudSessionStore()

  const prevIsProRef = useRef(isPro)
  useEffect(() => {
    if (prevIsProRef.current && !isPro && !planLoading) {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['canvas'] })
    }
    prevIsProRef.current = isPro
  }, [isPro, planLoading, queryClient])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSwitchRef = useRef<string | null>(null)
  const cachedTokenRef = useRef<string | null>(null)
  const broadcastRef = useRef<BroadcastChannel | null>(null)
  const newRouteHandledRef = useRef(false)
  // Captured at mount: was there already a saved canvas on this device?
  // Cloud prefs (preferredCanvasId) should only apply on fresh devices with no prior history.
  const hadLocalCanvasRef = useRef(!!localStorage.getItem('drawtool-cloud-active-canvas'))
  const [newRouteAllOccupied, setNewRouteAllOccupied] = useState(false)
  // True from page load until the /new destination canvas has been chosen.
  // While pending, the canvas data effect must not write to slot 1 or bump loadKey,
  // and App.tsx must not render Canvas — guarantees no canvas content leaks.
  const [newRoutePending, setNewRoutePending] = useState(newRoute)

  async function getAndCacheToken(): Promise<string | null> {
    const token = await getToken()
    if (token) cachedTokenRef.current = token
    return token
  }

  const api = useMemo(() => createApi(getAndCacheToken), [getToken])

  // ── Cross-device / cross-tab sync ─────────────────────────────────────────
  // BroadcastChannel: instant sync within the same browser
  // Polling: 30s interval for cross-device sync
  useEffect(() => {
    if (!isSignedIn) {
      broadcastRef.current?.close()
      broadcastRef.current = null
      return
    }
    const bc = new BroadcastChannel('drawtool-canvas-sync')
    broadcastRef.current = bc
    bc.onmessage = (e: MessageEvent<{ canvasId: string }>) => {
      if (e.data.canvasId !== useCloudSessionStore.getState().activeId) return
      if (localStorage.getItem(DIRTY_KEY)) return
      queryClient.invalidateQueries({ queryKey: ['canvas', e.data.canvasId] })
    }
    return () => { bc.close(); broadcastRef.current = null }
  }, [isSignedIn, queryClient])

  useEffect(() => {
    if (!isSignedIn || !activeId) return
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (localStorage.getItem(DIRTY_KEY)) return
      queryClient.invalidateQueries({ queryKey: ['canvas', activeId] })
    }, 30_000)
    return () => clearInterval(interval)
  }, [isSignedIn, activeId, queryClient])

  // Flush any deferred background sync when the tab becomes visible
  useEffect(() => {
    if (!isSignedIn || !activeId) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (localStorage.getItem(DIRTY_KEY)) return
      queryClient.invalidateQueries({ queryKey: ['canvas', activeId] })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isSignedIn, activeId, queryClient])

  // ── Workspaces query ──────────────────────────────────────────────────────

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<CloudWorkspace[]> => api.get('/workspaces'),
    enabled: isSignedIn === true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const allWorkspaces = workspacesQuery.data ?? []
  const workspace = allWorkspaces.find(w => w.id === activeWorkspaceId) ?? null

  // On initial load: resolve active workspace + canvas from localStorage
  useEffect(() => {
    const workspaces = workspacesQuery.data
    if (!workspaces) return
    if (workspaces.length === 0) {
      if (!planLoading && !useCloudSessionStore.getState().provisioning) {
        setProvisioning(true)
        ;(async () => {
          try {
            const newWs = await createWorkspace('My Workspace')
            if (newWs) {
              setActiveWorkspace(newWs.id, newWs.name)
              const newCanvas = await createCanvas('Canvas 1', newWs.id)
              if (newCanvas) setActiveCanvas(newCanvas.id)
            }
          } finally {
            setProvisioning(false)
          }
        })()
      }
      return
    }
    const savedWsId = useCloudSessionStore.getState().activeWorkspaceId
    const ws = (savedWsId ? workspaces.find(w => w.id === savedWsId) : undefined) ?? workspaces[0]
    setActiveWorkspace(ws.id, ws.name)
    if (ws.canvases.length > 0) {
      const savedCanvasId = useCloudSessionStore.getState().activeId
      // Validate saved ID against actual canvases — it may be stale/from another workspace
      const initial = (savedCanvasId ? ws.canvases.find(c => c.id === savedCanvasId) : undefined) ?? ws.canvases[0]
      if (initial.id !== useCloudSessionStore.getState().activeId) setActiveCanvas(initial.id)
    } else if (!planLoading && !useCloudSessionStore.getState().provisioning) {
      // New workspace with no canvases — provision one blank canvas
      setProvisioning(true)
      ;(async () => {
        try {
          const newCanvas = await createCanvas('Canvas 1', ws.id)
          if (newCanvas) setActiveCanvas(newCanvas.id)
        } finally {
          setProvisioning(false)
        }
      })()
    }
  }, [workspacesQuery.data, planLoading, canvasLimit, activeWorkspaceId])

  // Cross-device restore: if cloud prefs carry a preferredCanvasId from another device,
  // switch to it once workspaces have loaded and only once per sign-in session.
  // Only applies on a fresh device with no prior canvas history — a returning device
  // (one that already had drawtool-cloud-active-canvas in localStorage) keeps its own
  // last-used canvas and is not overridden by another device's preference.
  useEffect(() => {
    if (!preferredCanvasId || useCloudSessionStore.getState().cloudPrefApplied) return
    if (hadLocalCanvasRef.current) { setCloudPrefApplied(true); return }
    const workspaces = workspacesQuery.data
    if (!workspaces?.length) return
    const ws = workspaces.find(w => w.canvases.some(c => c.id === preferredCanvasId)) ?? workspaces[0]
    const canvas = ws?.canvases.find(c => c.id === preferredCanvasId)
    if (!canvas) return
    setCloudPrefApplied(true)
    if (canvas.id === useCloudSessionStore.getState().activeId) return
    setActiveCanvas(canvas.id)
  }, [preferredCanvasId, workspacesQuery.data])

  // ── Canvas query ──────────────────────────────────────────────────────────

  const canvasQuery = useQuery({
    queryKey: ['canvas', activeId],
    queryFn: () => api.get<{
      name: string
      updated_at: number
      data: { strokes: Stroke[]; view: { x: number; y: number; scale: number }; savedDark?: boolean; images?: Record<string, string> }
    }>(`/canvases/${activeId}`),
    enabled: !!activeId && isSignedIn === true,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Apply canvas data to localStorage when query resolves, then remount Canvas via loadKey
  useEffect(() => {
    if (!canvasQuery.data || !activeId) return

    // One-time backup of slot 1 before cloud overwrites it
    if (!useCloudSessionStore.getState().slot1BackedUp) {
      setSlot1BackedUp(true)
      localStorage.setItem('drawtool-precloud-strokes-1', localStorage.getItem('drawtool-strokes-1') ?? '')
      localStorage.setItem('drawtool-precloud-view-1', localStorage.getItem('drawtool-view-1') ?? '')
    }

    const { name, updated_at } = canvasQuery.data

    // If local state was modified after the last confirmed server save (e.g. erase then
    // quick refresh), slot 1 in localStorage is more recent than what the server returned.
    // Skip overwriting it and re-send the local state to the server instead.
    const dirtyId = localStorage.getItem(DIRTY_KEY)
    if (dirtyId === activeId) {
      // Only remount Canvas (bumpLoadKey) on a fresh page load — Canvas needs to read slot 1
      // for the first time. On BFCache restores (getUpdatedAt has a value), Canvas is already
      // rendering the correct local content, so remounting would disrupt any in-progress drawing.
      const wasInitialLoad = !getUpdatedAt(activeId)
      localStorage.removeItem(DIRTY_KEY)
      markUpdatedAt(activeId, updated_at)
      ;(async () => {
        const strokes = loadStrokes(CLOUD_SLOT)
        const view = loadView(CLOUD_SLOT)
        const images = await collectImages(strokes)
        api.put<{ ok: true }>(`/canvases/${activeId}`, { strokes, view, savedDark: isDarkRef.current, ...imagePayload(images) }).catch(() => {})
      })()
      setCachedCanvasName(name)
      if (wasInitialLoad) bumpLoadKey()
      return
    }

    // Poll re-fetch returned unchanged data — skip Canvas remount
    if (updated_at && getUpdatedAt(activeId) === updated_at) return

    const isInitialLoad = !getUpdatedAt(activeId)
    markUpdatedAt(activeId, updated_at)
    const capturedActiveId = activeId
    ;(async () => {
      const { data } = canvasQuery.data!
      // Store images in IDB before writing strokes — Canvas reads IDB on mount
      if (data.images) {
        await Promise.allSettled(
          Object.entries(data.images).map(([id, url]) => storeImage(id, url))
        )
      }
      // Bail out if the user switched canvases while images were being stored.
      // Without this guard, a slow IIFE from a previous canvas would overwrite slot 1
      // and call bumpLoadKey after a newer canvas has already correctly loaded.
      if (useCloudSessionStore.getState().activeId !== capturedActiveId) return
      const savedDark = data.savedDark ?? false
      const strokes = savedDark !== isDarkRef.current ? swapStrokeColors(data.strokes) : data.strokes
      saveStrokes(strokes, CLOUD_SLOT, true)
      if (isInitialLoad) storeThumbnail(capturedActiveId, strokes, isDarkRef.current)
      setCachedCanvasName(name)
      if (isInitialLoad) {
        // First load: restore saved viewport and remount Canvas
        saveView(data.view, CLOUD_SLOT)
        bumpLoadKey()
      } else {
        // Live sync: update strokes in-place so viewport is preserved
        window.dispatchEvent(new CustomEvent('drawtool:sync-strokes', { detail: { slot: CLOUD_SLOT, strokes } }))
      }
    })()
  }, [canvasQuery.data, activeId])

  // ── Save hook + beforeunload ──────────────────────────────────────────────

  useEffect(() => {
    if (isSignedIn === undefined) return
    if (!isSignedIn) {
      // Flush any pending cloud save before clearing the session (keepalive so it survives
      // the sign-out navigation). Mirrors the beforeunload handler — same refs, same approach.
      const id = useCloudSessionStore.getState().activeId
      const token = cachedTokenRef.current
      const hasPending = !!saveTimerRef.current || !!localStorage.getItem(DIRTY_KEY)
      if (id && token && hasPending) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        const strokes = loadStrokes(CLOUD_SLOT)
        const view = loadView(CLOUD_SLOT)
        const images = collectImagesSync(strokes)
        fetch(`${API_URL}/canvases/${id}`, {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ strokes, view, savedDark: isDarkRef.current, ...imagePayload(images) }),
        })
      }

      useCloudSessionStore.getState().setActiveCanvas(null)
      setSlot1BackedUp(false)

      // Restore slot 1 to whatever was there before cloud took it over.
      const preStrokes = localStorage.getItem('drawtool-precloud-strokes-1')
      const preView = localStorage.getItem('drawtool-precloud-view-1')
      if (preStrokes) localStorage.setItem('drawtool-strokes-1', preStrokes)
      else localStorage.removeItem('drawtool-strokes-1')
      if (preView) localStorage.setItem('drawtool-view-1', preView)
      else localStorage.removeItem('drawtool-view-1')
      localStorage.removeItem('drawtool-precloud-strokes-1')
      localStorage.removeItem('drawtool-precloud-view-1')
      localStorage.removeItem(DIRTY_KEY)

      resetSession()
      return
    }

    setSaveHook((canvasIndex, strokes) => {
      if (canvasIndex !== CLOUD_SLOT) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      // Capture the canvas ID at schedule time. The closure holds canvas 1's strokes;
      // if the user switches before the timer fires, activeId will be canvas 2 — we
      // must not save canvas 1's strokes to canvas 2's blob.
      const forId = useCloudSessionStore.getState().activeId
      localStorage.setItem(DIRTY_KEY, forId ?? '')
      saveTimerRef.current = setTimeout(async () => {
        const id = useCloudSessionStore.getState().activeId
        if (!id || id !== forId) return // canvas switched since timer was scheduled
        if (localStorage.getItem(DIRTY_KEY) !== forId) return // dirty-recovery path already handled this save
        const view = loadView(CLOUD_SLOT)
        const images = await collectImages(strokes)
        api.put<{ ok: true }>(`/canvases/${id}`, { strokes, view, savedDark: isDarkRef.current, ...imagePayload(images) }).then(() => {
          localStorage.removeItem(DIRTY_KEY)
          broadcastRef.current?.postMessage({ canvasId: id })
          queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
            old.map(w => ({ ...w, canvases: w.canvases.map(c => c.id === id ? { ...c, is_empty: 0, stroke_count: strokes.length } : c) }))
          )
          storeThumbnail(id, strokes, isDarkRef.current)
        }).catch(() => {
          window.dispatchEvent(new CustomEvent('drawtool:toast', { detail: { message: '⚠ Save failed — check your connection' } }))
        })
      }, SAVE_DEBOUNCE_MS)
    })

    function onBeforeUnload() {
      const id = useCloudSessionStore.getState().activeId
      const token = cachedTokenRef.current
      if (!id || !token) return
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      // Always flush — covers pan-only sessions (no pending stroke save) and pending saves.
      // Use the synchronous image cache since we can't await in beforeunload.
      const strokes = loadStrokes(CLOUD_SLOT)
      const view = loadView(CLOUD_SLOT)
      const images = collectImagesSync(strokes)
      fetch(`${API_URL}/canvases/${id}`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strokes, view, savedDark: isDarkRef.current, ...imagePayload(images) }),
      })
      // Don't clear DIRTY_KEY — keepalive success isn't guaranteed; the next page load
      // will use local state and re-send if needed, then clear it.
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      // Set a no-op instead of null so hasSaveHook() stays true while the cloud Canvas
      // is still unmounting. Canvas cleanup skips its localStorage flush when
      // hasSaveHook() is true, which prevents it from overwriting the pre-cloud
      // strokes that the !isSignedIn branch restores to slot 1.
      setSaveHook(() => {})
    }
  }, [isSignedIn])

  // Clear the no-op save hook after the cloud Canvas has unmounted (activeId → null).
  // This runs after Canvas cleanup, so local-mode canvas switches flush correctly.
  useEffect(() => {
    if (activeId === null && isSignedIn === false) setSaveHook(null)
  }, [activeId, isSignedIn])

  // ── Canvas switching helpers ──────────────────────────────────────────────

  async function flushCurrentCanvas(): Promise<boolean> {
    const currentId = useCloudSessionStore.getState().activeId
    if (!currentId) return true
    // If the short debounce already fired and DIRTY_KEY is clear, nothing to flush.
    if (!saveTimerRef.current && !localStorage.getItem(DIRTY_KEY)) return true
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const strokes = loadStrokes(CLOUD_SLOT)
    const view = loadView(CLOUD_SLOT)
    const images = await collectImages(strokes)
    const updated_at = Math.floor(Date.now() / 1000)
    const ok = await api.put<{ ok: true }>(`/canvases/${currentId}`, { strokes, view, savedDark: isDarkRef.current, ...imagePayload(images) }).then(() => true).catch(() => false)
    if (ok) {
      // Only clear DIRTY_KEY if no new strokes arrived while the PUT was in flight.
      // If saveTimerRef is armed, new strokes came in — that timer will clear DIRTY_KEY after saving them.
      if (!saveTimerRef.current && localStorage.getItem(DIRTY_KEY) === currentId) localStorage.removeItem(DIRTY_KEY)
      // Update the React Query cache with the flushed data so that populateSlot1FromCache
      // reads the correct strokes if the user switches back before the server refetch completes.
      type CachedCanvas = { name: string; updated_at: number; data: { strokes: Stroke[]; view: typeof view; savedDark?: boolean; images?: Record<string, string> } }
      queryClient.setQueryData<CachedCanvas>(['canvas', currentId], old => ({
        name: old?.name ?? '',
        updated_at,
        data: { strokes, view, savedDark: isDarkRef.current, ...(Object.keys(images).length > 0 ? { images } : {}) },
      }))
      markUpdatedAt(currentId, updated_at)
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => ({ ...w, canvases: w.canvases.map(c => c.id === currentId ? { ...c, is_empty: 0, stroke_count: strokes.length } : c) }))
      )
      storeThumbnail(currentId, strokes, isDarkRef.current)
    }
    return ok
  }

  function leavingCanvas(id: string, flushSucceeded = true) {
    // Slot 1 is about to be cleared. Mark the query stale so re-entry always refetches.
    // Only clear DIRTY_KEY if the flush succeeded — if it failed, DIRTY_KEY must survive
    // so the dirty-recovery path on re-entry can re-send the local changes to the server.
    if (flushSucceeded && localStorage.getItem(DIRTY_KEY) === id) localStorage.removeItem(DIRTY_KEY)
    queryClient.invalidateQueries({ queryKey: ['canvas', id], refetchType: 'none' })
  }

  function populateSlot1FromCache(id: string) {
    // Pre-populate slot 1 with cached data so the incoming Canvas mounts with
    // the correct strokes immediately, rather than blank then patched by an effect.
    type CachedCanvas = { data: { strokes: Stroke[]; view: { x: number; y: number; scale: number }; savedDark?: boolean } }
    const cached = queryClient.getQueryData<CachedCanvas>(['canvas', id])
    if (!cached) { saveStrokes([], CLOUD_SLOT, true); return }
    const strokes = (cached.data.savedDark ?? false) !== isDarkRef.current
      ? swapStrokeColors(cached.data.strokes)
      : cached.data.strokes
    saveView(cached.data.view, CLOUD_SLOT)
    saveStrokes(strokes, CLOUD_SLOT, true)
  }

  async function switchCanvas(id: string): Promise<void> {
    pendingSwitchRef.current = id
    if (id === useCloudSessionStore.getState().activeId) return
    const currentId = useCloudSessionStore.getState().activeId
    const flushOk = await flushCurrentCanvas()
    // If the user switched again while the flush was in flight, abandon this switch.
    if (pendingSwitchRef.current !== id) return
    if (currentId) leavingCanvas(currentId, flushOk)
    populateSlot1FromCache(id)
    // Force a server refetch to pick up cross-device changes (staleTime: Infinity would skip it)
    queryClient.invalidateQueries({ queryKey: ['canvas', id], refetchType: 'none' })
    setActiveCanvas(id)
  }

  async function switchWorkspace(id: string, initialCanvasId?: string): Promise<void> {
    if (!id || id === useCloudSessionStore.getState().activeWorkspaceId) return
    // Read fresh from cache — allWorkspaces may be stale if called immediately after createWorkspace
    const freshWorkspaces = queryClient.getQueryData<CloudWorkspace[]>(['workspaces']) ?? allWorkspaces
    const ws = freshWorkspaces.find(w => w.id === id)
    if (!ws) return
    const currentId = useCloudSessionStore.getState().activeId
    const flushOk = await flushCurrentCanvas()
    if (currentId) leavingCanvas(currentId, flushOk)
    setActiveWorkspace(ws.id, ws.name)
    if (ws.canvases.length > 0) {
      const target = initialCanvasId ? ws.canvases.find(c => c.id === initialCanvasId) : null
      const canvasId = (target ?? ws.canvases[0]).id
      populateSlot1FromCache(canvasId)
      // Force a server refetch to pick up cross-device changes (staleTime: Infinity would skip it)
      queryClient.invalidateQueries({ queryKey: ['canvas', canvasId], refetchType: 'none' })
      setActiveCanvas(canvasId)
    } else {
      saveStrokes([], CLOUD_SLOT, true)
      setActiveCanvas(null)
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createCanvasMutation = useMutation({
    mutationFn: ({ workspaceId, name }: { workspaceId: string; name?: string }) =>
      api.post<{ id: string; name: string }>('/canvases', { workspaceId, name }),
    onSuccess: ({ id, name: canvasName }, { workspaceId }) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => {
          if (w.id !== workspaceId) return w
          const newCanvas: CloudCanvasMeta = {
            id, name: canvasName, position: w.canvases.length,
            updated_at: Math.floor(Date.now() / 1000), is_empty: 1, stroke_count: 0, share_token: null, share_enabled: 0,
          }
          return { ...w, canvases: [...w.canvases, newCanvas] }
        })
      )
    },
  })

  async function createCanvas(name?: string, workspaceId?: string): Promise<CloudCanvasMeta | null> {
    const targetWsId = workspaceId ?? workspace?.id
    if (!targetWsId) return null
    const targetWs = allWorkspaces.find(w => w.id === targetWsId)
    if (!targetWs) return null
    try {
      const { id, name: canvasName } = await createCanvasMutation.mutateAsync({ workspaceId: targetWsId, name })
      return { id, name: canvasName, position: targetWs.canvases.length, updated_at: Math.floor(Date.now() / 1000), is_empty: 1, stroke_count: 0, share_token: null, share_enabled: 0 }
    } catch {
      return null
    }
  }

  const createWorkspaceMutation = useMutation({
    mutationFn: (name?: string) =>
      api.post<{ id: string; name: string }>('/workspaces', { name }),
    onSuccess: ({ id, name: wsName }) => {
      const newWs: CloudWorkspace = { id, name: wsName, share_token: null, share_enabled: 0, is_pinned: 0, is_favourite: 0, canvases: [] }
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) => [...old, newWs])
    },
  })

  async function createWorkspace(name?: string): Promise<CloudWorkspace | null> {
    try {
      const { id, name: wsName } = await createWorkspaceMutation.mutateAsync(name)
      return { id, name: wsName, share_token: null, share_enabled: 0, is_pinned: 0, is_favourite: 0, canvases: [] }
    } catch {
      return null
    }
  }

  const renameCanvasMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<void>(`/canvases/${id}`, { name }),
    onSuccess: (_, { id, name }) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => ({ ...w, canvases: w.canvases.map(c => c.id === id ? { ...c, name } : c) }))
      )
    },
  })

  async function renameCanvas(id: string, name: string): Promise<boolean> {
    try { await renameCanvasMutation.mutateAsync({ id, name }); return true }
    catch { return false }
  }

  const renameWorkspaceMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<void>(`/workspaces/${id}`, { name }),
    onSuccess: (_, { id, name }) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => w.id === id ? { ...w, name } : w)
      )
    },
  })

  async function renameWorkspace(id: string, name: string): Promise<boolean> {
    try { await renameWorkspaceMutation.mutateAsync({ id, name }); return true }
    catch { return false }
  }

  const pinWorkspaceMutation = useMutation({
    mutationFn: ({ id, is_pinned }: { id: string; is_pinned: boolean }) =>
      api.patch<void>(`/workspaces/${id}`, { is_pinned }),
    onSuccess: (_, { id, is_pinned }) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => w.id === id ? { ...w, is_pinned: is_pinned ? 1 : 0 } : { ...w, is_pinned: 0 })
      )
    },
  })

  async function pinWorkspace(id: string, is_pinned: boolean): Promise<boolean> {
    try { await pinWorkspaceMutation.mutateAsync({ id, is_pinned }); return true }
    catch { return false }
  }

  const favouriteWorkspaceMutation = useMutation({
    mutationFn: ({ id, is_favourite }: { id: string; is_favourite: boolean }) =>
      api.patch<void>(`/workspaces/${id}`, { is_favourite }),
    onSuccess: (_, { id, is_favourite }) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => w.id === id ? { ...w, is_favourite: is_favourite ? 1 : 0 } : w)
      )
    },
  })

  async function favouriteWorkspace(id: string, is_favourite: boolean): Promise<boolean> {
    try { await favouriteWorkspaceMutation.mutateAsync({ id, is_favourite }); return true }
    catch { return false }
  }

  const [currentShares, setCurrentShares] = useState<ShareLink[]>([])

  async function loadCanvasShares(canvasId: string) {
    try {
      const shares = await api.get<ShareLink[]>(`/canvases/${canvasId}/shares`)
      setCurrentShares(shares)
    } catch { /* ignore */ }
  }

  const createShareMutation = useMutation({
    mutationFn: (canvasId: string) =>
      api.post<ShareLink & { url: string }>(`/canvases/${canvasId}/share`),
    onSuccess: (data) => {
      setCurrentShares(prev => {
        if (data.type === 'live') {
          return [data, ...prev.filter(s => s.type !== 'live')]
        }
        return [data, ...prev]
      })
    },
  })

  async function createShare(canvasId: string): Promise<(ShareLink & { url: string }) | null> {
    try { return await createShareMutation.mutateAsync(canvasId) }
    catch { return null }
  }

  const deleteShareMutation = useMutation({
    mutationFn: ({ canvasId, shareToken }: { canvasId: string; shareToken: string }) =>
      api.delete<void>(`/canvases/${canvasId}/share/${shareToken}`),
    onSuccess: (_, { shareToken }) => {
      setCurrentShares(prev => prev.filter(s => s.token !== shareToken))
    },
  })

  async function deleteShare(canvasId: string, shareToken: string): Promise<boolean> {
    try { await deleteShareMutation.mutateAsync({ canvasId, shareToken }); return true }
    catch { return false }
  }

  const shareWorkspaceMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ token: string; url: string }>(`/workspaces/${id}/share`),
    onSuccess: (data, id) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => w.id === id ? { ...w, share_token: data.token, share_enabled: 1 } : w)
      )
    },
  })

  async function shareWorkspace(): Promise<{ token: string; url: string } | null> {
    if (!workspace) return null
    try { return await shareWorkspaceMutation.mutateAsync(workspace.id) }
    catch { return null }
  }

  const unshareWorkspaceMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/workspaces/${id}/share`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => w.id === id ? { ...w, share_enabled: 0 } : w)
      )
    },
  })

  async function unshareWorkspace(): Promise<boolean> {
    if (!workspace) return false
    try { await unshareWorkspaceMutation.mutateAsync(workspace.id); return true }
    catch { return false }
  }

  const activeCanvasMeta = workspace?.canvases.find(c => c.id === activeId) ?? null

  // ── Clear canvas (wipe content, keep the slot) ───────────────────────────

  async function clearCanvas(id: string): Promise<boolean> {
    try {
      const empty = { strokes: [], view: { x: 0, y: 0, scale: 1 }, savedDark: isDarkRef.current }
      await api.put<{ ok: true }>(`/canvases/${id}`, empty)
      if (id === useCloudSessionStore.getState().activeId) {
        saveStrokes([], CLOUD_SLOT)
        saveView({ x: 0, y: 0, scale: 1 }, CLOUD_SLOT)
        bumpClearKey()
      } else {
        // Evict cached canvas data so the next visit fetches fresh empty content
        queryClient.removeQueries({ queryKey: ['canvas', id] })
        localStorage.removeItem(`drawtool-thumb-${id}`)
      }
      return true
    } catch { return false }
  }

  // ── Delete canvas ─────────────────────────────────────────────────────────

  const deleteCanvasMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/canvases/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => ({
          ...w,
          canvases: w.canvases
            .filter(c => c.id !== id)
            .map((c, i) => ({ ...c, position: i })),
        }))
      )
      localStorage.removeItem(`drawtool-thumb-${id}`)
    },
  })

  async function deleteCanvas(id: string): Promise<boolean> {
    try {
      // If deleting the active canvas, switch to another one first
      const ws = allWorkspaces.find(w => w.canvases.some(c => c.id === id))
      if (ws && id === useCloudSessionStore.getState().activeId) {
        const next = ws.canvases.find(c => c.id !== id)
        if (next) await switchCanvas(next.id)
        else setActiveCanvas(null)
      }
      await deleteCanvasMutation.mutateAsync(id)
      return true
    } catch { return false }
  }

  // ── Delete workspace ──────────────────────────────────────────────────────

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/workspaces/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.filter(w => w.id !== id)
      )
    },
  })

  async function deleteWorkspace(id: string): Promise<boolean> {
    try {
      const remaining = allWorkspaces.filter(w => w.id !== id)
      if (remaining.length > 0) {
        await switchWorkspace(remaining[0].id)
      } else {
        // Deleting the last workspace — clear activeId now to prevent a 404 canvas query
        // while the workspace effect re-provisions a replacement.
        const currentId = useCloudSessionStore.getState().activeId
        if (currentId) leavingCanvas(currentId, true)
        setActiveCanvas(null)
      }
      await deleteWorkspaceMutation.mutateAsync(id)
      return true
    } catch { return false }
  }

  // ── Reorder canvases ──────────────────────────────────────────────────────

  const reorderCanvasesMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<void>('/canvases/reorder', { ids }),
    onSuccess: (_, ids) => {
      queryClient.setQueryData<CloudWorkspace[]>(['workspaces'], (old = []) =>
        old.map(w => ({
          ...w,
          canvases: [...w.canvases].sort(
            (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
          ).map((c, i) => ({ ...c, position: i })),
        }))
      )
    },
  })

  async function reorderCanvases(ids: string[]): Promise<boolean> {
    try { await reorderCanvasesMutation.mutateAsync(ids); return true }
    catch { return false }
  }

  // ── /new route handler for cloud users ───────────────────────────────────

  useEffect(() => {
    if (!newRoute || newRouteHandledRef.current || planLoading) return
    const workspaces = workspacesQuery.data
    if (!workspaces?.length) return

    const ws = workspaces.find(w => w.id === useCloudSessionStore.getState().activeWorkspaceId) ?? workspaces[0]
    if (!ws) return

    newRouteHandledRef.current = true
    // Clear slot 1 before Canvas mounts so it doesn't briefly flash stale strokes.
    saveStrokes([], CLOUD_SLOT, true)
    setNewRoutePending(false)

    const candidates = ws.canvases.slice(0, canvasLimit)
    // is_empty comes from the backend — reliable without loading canvas content.
    const blank = candidates.find(c => c.is_empty === 1)

    setActiveWorkspace(ws.id, ws.name)

    if (blank) {
      setActiveCanvas(blank.id)
    } else {
      // All slots occupied: open least-recently-updated canvas and signal blur
      const oldest = [...candidates].sort((a, b) => a.updated_at - b.updated_at)[0]
      if (oldest) setActiveCanvas(oldest.id)
      setNewRouteAllOccupied(true)
    }
  }, [newRoute, workspacesQuery.data, planLoading])

  async function prefetchThumbnail(id: string): Promise<string | null> {
    type CanvasResp = { data: { strokes: Stroke[]; savedDark?: boolean } }
    // Check RQ cache first — no network needed
    const cached = queryClient.getQueryData<CanvasResp>(['canvas', id])
    if (cached?.data?.strokes) {
      const strokes = (cached.data.savedDark ?? false) !== isDarkRef.current
        ? swapStrokeColors(cached.data.strokes)
        : cached.data.strokes
      const url = generateCanvasThumbnail(strokes, isDarkRef.current)
      if (url) localStorage.setItem(`drawtool-thumb-${id}`, url)
      else localStorage.removeItem(`drawtool-thumb-${id}`)
      return url ?? null
    }
    // Not cached — fetch from API (one-time per canvas; localStorage prevents future fetches)
    try {
      const result = await api.get<CanvasResp>(`/canvases/${id}`)
      const savedDark = result.data.savedDark ?? false
      const strokes = savedDark !== isDarkRef.current
        ? swapStrokeColors(result.data.strokes ?? [])
        : (result.data.strokes ?? [])
      const url = generateCanvasThumbnail(strokes, isDarkRef.current)
      if (url) localStorage.setItem(`drawtool-thumb-${id}`, url)
      else localStorage.removeItem(`drawtool-thumb-${id}`)
      return url ?? null
    } catch {
      return null
    }
  }

  return {
    workspace, allWorkspaces, activeId, activeCanvasMeta,
    workspacesLoaded: workspacesQuery.isSuccess,
    loading: canvasQuery.isFetching,
    cachedWorkspaceName, cachedCanvasName,
    newRouteAllOccupied, newRoutePending,
    switchCanvas, switchWorkspace, createCanvas, createWorkspace,
    fetchWorkspace: () => { workspacesQuery.refetch() },
    renameCanvas, renameWorkspace, pinWorkspace, favouriteWorkspace,
    clearCanvas, deleteCanvas, clearKey, loadKey, deleteWorkspace, reorderCanvases,
    currentShares, loadCanvasShares, createShare, deleteShare,
    shareWorkspace, unshareWorkspace,
    prefetchThumbnail,
  }
}
