import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'

const ACTIVE_CANVAS_KEY    = 'drawtool-cloud-active-canvas'
const ACTIVE_WORKSPACE_KEY = 'drawtool-cloud-active-workspace'
const CACHED_WS_NAME_KEY   = 'drawtool-cloud-ws-name'
const CACHED_C_NAME_KEY    = 'drawtool-cloud-c-name'

type Persisted = {
  activeId: string | null
  activeWorkspaceId: string | null
  cachedWorkspaceName: string | null
  cachedCanvasName: string | null
}

type CloudSessionState = Persisted & {
  // session-only (not persisted)
  loadKey: number
  clearKey: number
  lastAppliedUpdatedAt: Record<string, number>
  cloudPrefApplied: boolean
  slot1BackedUp: boolean
  provisioning: boolean
  // actions
  setActiveCanvas:     (id: string | null)                       => void
  setActiveWorkspace:  (id: string | null, name?: string | null) => void
  setCachedCanvasName: (name: string | null)                     => void
  bumpLoadKey:         ()                                        => void
  bumpClearKey:        ()                                        => void
  markUpdatedAt:       (canvasId: string, updatedAt: number)     => void
  getUpdatedAt:        (canvasId: string) => number | undefined
  setCloudPrefApplied: (val: boolean)                            => void
  setSlot1BackedUp:    (val: boolean)                            => void
  setProvisioning:     (val: boolean)                            => void
  resetSession:        ()                                        => void
}

// Custom storage adapter - maps to individual existing localStorage keys
const legacyStorage: PersistStorage<Persisted> = {
  getItem: (_name): StorageValue<Persisted> => ({
    state: {
      activeId:            localStorage.getItem(ACTIVE_CANVAS_KEY),
      activeWorkspaceId:   localStorage.getItem(ACTIVE_WORKSPACE_KEY),
      cachedWorkspaceName: localStorage.getItem(CACHED_WS_NAME_KEY),
      cachedCanvasName:    localStorage.getItem(CACHED_C_NAME_KEY),
    },
    version: 0,
  }),
  setItem: (_name, { state }) => {
    state.activeId != null
      ? localStorage.setItem(ACTIVE_CANVAS_KEY, state.activeId)
      : localStorage.removeItem(ACTIVE_CANVAS_KEY)
    state.activeWorkspaceId != null
      ? localStorage.setItem(ACTIVE_WORKSPACE_KEY, state.activeWorkspaceId)
      : localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    state.cachedWorkspaceName != null
      ? localStorage.setItem(CACHED_WS_NAME_KEY, state.cachedWorkspaceName)
      : localStorage.removeItem(CACHED_WS_NAME_KEY)
    state.cachedCanvasName != null
      ? localStorage.setItem(CACHED_C_NAME_KEY, state.cachedCanvasName)
      : localStorage.removeItem(CACHED_C_NAME_KEY)
  },
  removeItem: () => {
    localStorage.removeItem(ACTIVE_CANVAS_KEY)
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    localStorage.removeItem(CACHED_WS_NAME_KEY)
    localStorage.removeItem(CACHED_C_NAME_KEY)
  },
}

const SESSION_DEFAULTS = {
  loadKey: 0,
  clearKey: 0,
  lastAppliedUpdatedAt: {} as Record<string, number>,
  cloudPrefApplied: false,
  slot1BackedUp: false,
  provisioning: false,
}

export const useCloudSessionStore = create<CloudSessionState>()(
  persist(
    (set, get) => ({
      activeId: null,
      activeWorkspaceId: null,
      cachedWorkspaceName: null,
      cachedCanvasName: null,
      ...SESSION_DEFAULTS,

      setActiveCanvas: (id) => set({ activeId: id }),
      setActiveWorkspace: (id, name) => set({
        activeWorkspaceId: id,
        ...(name !== undefined ? { cachedWorkspaceName: name } : {}),
      }),
      setCachedCanvasName: (name) => set({ cachedCanvasName: name }),
      bumpLoadKey:  () => set(s => ({ loadKey:  s.loadKey  + 1 })),
      bumpClearKey: () => set(s => ({ clearKey: s.clearKey + 1 })),
      markUpdatedAt: (canvasId, updatedAt) =>
        set(s => {
          const existing = s.lastAppliedUpdatedAt
          const entries = Object.entries(existing)
          // Cap at 100 entries (drop oldest 50 when full) to prevent unbounded growth.
          const base = entries.length >= 100 ? Object.fromEntries(entries.slice(-50)) : existing
          return { lastAppliedUpdatedAt: { ...base, [canvasId]: updatedAt } }
        }),
      getUpdatedAt: (canvasId) => get().lastAppliedUpdatedAt[canvasId],
      setCloudPrefApplied: (val) => set({ cloudPrefApplied: val }),
      setSlot1BackedUp:    (val) => set({ slot1BackedUp: val }),
      setProvisioning:     (val) => set({ provisioning: val }),
      resetSession: () => set({ ...SESSION_DEFAULTS, cachedWorkspaceName: null, cachedCanvasName: null }),
    }),
    {
      name: 'drawtool-cloud-session',
      storage: legacyStorage,
      partialize: (s): Persisted => ({
        activeId:            s.activeId,
        activeWorkspaceId:   s.activeWorkspaceId,
        cachedWorkspaceName: s.cachedWorkspaceName,
        cachedCanvasName:    s.cachedCanvasName,
      }),
    }
  )
)
