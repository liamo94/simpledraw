import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser, UserButton, SignInButton } from '@clerk/clerk-react'
import Canvas from './Canvas'
import { loadStrokes, saveStrokes, saveView } from '../canvas/storage'
import { storeImage } from '../canvas/imageStore'
import type { Stroke } from '../canvas/types'
import { isDarkTheme, getPanelBackground } from '../canvas/rendering'
import type { Theme, GridType } from '../hooks/useSettings'
import { createApi } from '../lib/api'
import { useCloudSessionStore } from '../stores/cloudSessionStore'

function loadViewerSettings(): { theme: Theme; gridType: GridType } {
  try {
    const raw = localStorage.getItem('drawtool-settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        theme: parsed.theme ?? 'dark',
        gridType: parsed.gridType ?? 'off',
      }
    }
  } catch { /* ignore */ }
  return { theme: 'dark', gridType: 'off' }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
// Dedicated slot for share viewer — doesn't conflict with user's slots 1–9
const SHARE_SLOT = 10

type CanvasData = { strokes: Stroke[]; view: { x: number; y: number; scale: number }; savedDark?: boolean; images?: Record<string, string> }

type CanvasEntry = {
  id: string
  name: string
  position: number
  data: CanvasData
}

type ShareData =
  | { type: 'canvas'; name: string; data: CanvasData; expires_at?: number | null }
  | { type: 'workspace'; name: string; canvases: CanvasEntry[] }

function swapStrokeColors(strokes: Stroke[]): Stroke[] {
  const swap = (c: string) => c === '#000000' ? '#ffffff' : c === '#ffffff' ? '#000000' : c
  return strokes.map(s => ({
    ...s,
    color: swap(s.color),
    subStrokes: s.subStrokes ? swapStrokeColors(s.subStrokes as Stroke[]) : undefined,
  }))
}

// Swap stroke colours if the saved theme polarity differs from the viewer's theme.
function adaptStrokes(data: CanvasData, viewerIsDark: boolean): Stroke[] {
  const savedIsDark = data.savedDark !== false // undefined treated as dark (historical default)
  return savedIsDark !== viewerIsDark ? swapStrokeColors(data.strokes) : data.strokes
}

// token and isWorkspace are derived from the URL by App.tsx
export default function ShareViewer({ token, isWorkspace }: { token: string; isWorkspace: boolean }) {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()
  const api = useMemo(() => createApi(getToken), [getToken])
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  type ForkStatus = 'idle' | 'loading' | 'done' | 'error'
  const [workspaceStatus, setWorkspaceStatus] = useState<ForkStatus>('idle')
  const [canvasStatus, setCanvasStatus] = useState<ForkStatus | 'conflict'>('idle')
  const [canvasLimitHit, setCanvasLimitHit] = useState(false)
  const [pendingEntry, setPendingEntry] = useState<CanvasEntry | null>(null)
  const [viewerSettings, setViewerSettings] = useState(loadViewerSettings)
  const shareDataRef = useRef<ShareData | null>(null)
  shareDataRef.current = shareData
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const lastDPressRef = useRef(0)

  useEffect(() => {
    const url = isWorkspace
      ? `${API_URL}/share/workspace/${token}`
      : `${API_URL}/share/${token}`

    fetch(url)
      .then(r => r.ok ? r.json() as Promise<ShareData> : Promise.reject())
      .then(data => {
        setShareData(data)
        loadSlot(data, 0, isDarkTheme(viewerSettings.theme))
      })
      .catch(() => setError(true))
  }, [token, isWorkspace])

  // Re-adapt stroke colours when the viewer theme changes
  useEffect(() => {
    if (!shareDataRef.current) return
    loadSlot(shareDataRef.current, activeIndexRef.current, isDarkTheme(viewerSettings.theme))
  }, [viewerSettings.theme])

  // Keyboard shortcuts: g = cycle grid, dd = cycle theme
  useEffect(() => {
    const THEMES = ['dark', 'midnight', 'lumber', 'slate', 'journal', 'sky', 'sand', 'white'] as const
    const GRIDS = ['off', 'dot', 'square'] as const

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.altKey || e.ctrlKey) return

      if (e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        setViewerSettings(s => ({ ...s, gridType: GRIDS[(GRIDS.indexOf(s.gridType as typeof GRIDS[number]) + 1) % GRIDS.length] }))
        return
      }
      if (e.key === 'G' && e.shiftKey) {
        e.preventDefault()
        setViewerSettings(s => ({ ...s, gridType: GRIDS[(GRIDS.indexOf(s.gridType as typeof GRIDS[number]) - 1 + GRIDS.length) % GRIDS.length] }))
        return
      }
      if (e.key === 'd' && !e.shiftKey) {
        const now = performance.now()
        if (now - lastDPressRef.current < 400) {
          lastDPressRef.current = 0
          setViewerSettings(s => ({ ...s, theme: THEMES[(THEMES.indexOf(s.theme as typeof THEMES[number]) + 1) % THEMES.length] }))
        } else {
          lastDPressRef.current = now
        }
        return
      }
      if (e.key === 'D' && e.shiftKey) {
        const now = performance.now()
        if (now - lastDPressRef.current < 400) {
          lastDPressRef.current = 0
          setViewerSettings(s => ({ ...s, theme: THEMES[(THEMES.indexOf(s.theme as typeof THEMES[number]) - 1 + THEMES.length) % THEMES.length] }))
        } else {
          lastDPressRef.current = now
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function loadSlot(data: ShareData, idx: number, viewerIsDark: boolean) {
    const canvasData = data.type === 'canvas' ? data.data : data.canvases[idx]?.data
    if (!canvasData) return
    if (canvasData.images) {
      await Promise.all(
        Object.entries(canvasData.images).map(([id, url]) => storeImage(id, url))
      )
    }
    saveStrokes(adaptStrokes(canvasData, viewerIsDark), SHARE_SLOT)
    saveView(canvasData.view, SHARE_SLOT)
    setCanvasKey(k => k + 1)
  }

  function switchCanvas(idx: number) {
    if (!shareData || shareData.type !== 'workspace') return
    setActiveIndex(idx)
    setCanvasStatus('idle')
    setCanvasLimitHit(false)
    loadSlot(shareData, idx, isDarkTheme(viewerSettings.theme))
  }

  function getActiveEntry(): CanvasEntry {
    if (!shareData) return { id: 'single', name: '', position: 0, data: { strokes: [], view: { x: 0, y: 0, scale: 1 } } }
    if (shareData.type === 'canvas') return { id: 'single', name: shareData.name, position: 0, data: shareData.data }
    return shareData.canvases[activeIndex] ?? shareData.canvases[0]
  }

  async function getActiveWorkspace(): Promise<{ id: string; canvases: Array<{ id: string }> } | null> {
    try {
      const workspaces = await api.get<Array<{ id: string; canvases: Array<{ id: string }> }>>('/workspaces')
      const activeWorkspaceId = useCloudSessionStore.getState().activeWorkspaceId
      return (activeWorkspaceId ? workspaces.find(w => w.id === activeWorkspaceId) : null) ?? workspaces[0] ?? null
    } catch { return null }
  }

  async function createAndFillCanvas(workspaceId: string, entry: CanvasEntry) {
    const { id } = await api.post<{ id: string }>('/canvases', { workspaceId, name: entry.name })
    await api.put<void>(`/canvases/${id}`, entry.data)
  }

  async function forkCanvas() {
    if (!shareData || canvasStatus === 'loading') return
    const entry = getActiveEntry()
    setCanvasLimitHit(false)
    setCanvasStatus('loading')

    if (isSignedIn) {
      try {
        const ws = await getActiveWorkspace()
        if (!ws) throw new Error('no workspace')
        await createAndFillCanvas(ws.id, entry)
        setCanvasStatus('done')
      } catch (e) {
        if ((e as { status?: number }).status === 403) {
          setCanvasLimitHit(true)
          setPendingEntry(entry)
        }
        setCanvasStatus('error')
      }
    } else {
      const freeSlot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(n => loadStrokes(n).length === 0)
      if (freeSlot !== undefined) {
        saveStrokes(entry.data.strokes, freeSlot)
        saveView(entry.data.view, freeSlot)
        localStorage.setItem('drawtool-active-canvas', String(freeSlot))
        setCanvasStatus('done')
      } else {
        setPendingEntry(entry)
        setCanvasStatus('conflict')
      }
    }
  }

  async function replaceFirstCloudCanvas() {
    if (!pendingEntry) return
    setCanvasStatus('loading')
    try {
      const ws = await getActiveWorkspace()
      const canvasId = ws?.canvases[0]?.id
      if (!canvasId) throw new Error('no canvas')
      await api.put<void>(`/canvases/${canvasId}`, pendingEntry.data)
      setCanvasStatus('done')
    } catch {
      setCanvasStatus('error')
    }
  }

  function forkCanvasOverwrite() {
    if (!pendingEntry) return
    saveStrokes(pendingEntry.data.strokes, 1)
    saveView(pendingEntry.data.view, 1)
    localStorage.setItem('drawtool-active-canvas', '1')
    setCanvasStatus('done')
  }

  function downloadCanvas() {
    const entry = pendingEntry ?? getActiveEntry()
    const blob = new Blob([JSON.stringify(entry.data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entry.name || 'canvas'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function forkWorkspace() {
    if (!shareData || shareData.type !== 'workspace' || workspaceStatus === 'loading') return

    if (!isSignedIn) {
      window.location.href = 'https://unleash.drawzil.la'
      return
    }

    setWorkspaceStatus('loading')
    try {
      const { id: newWorkspaceId } = await api.post<{ id: string }>('/workspaces', { name: shareData.name })
      await Promise.all(shareData.canvases.map(entry => createAndFillCanvas(newWorkspaceId, entry)))
      setWorkspaceStatus('done')
    } catch (e) {
      if ((e as { status?: number }).status === 403) { window.location.href = 'https://unleash.drawzil.la'; return }
      setWorkspaceStatus('error')
    }
  }

  function openApp() {
    window.location.href = '/'
  }

  const expiresAt = shareData?.type === 'canvas' ? (shareData.expires_at ?? null) : null

  function formatExpiry(ts: number): string {
    const secs = ts - Math.floor(Date.now() / 1000)
    if (secs <= 0) return 'Link expired'
    const days = Math.ceil(secs / 86400)
    if (days > 1) return `Expires in ${days} days`
    const hours = Math.floor(secs / 3600)
    return hours > 0 ? `Expires in ${hours}h` : 'Expires soon'
  }

  const canvasName = shareData?.type === 'canvas'
    ? shareData.name
    : shareData?.type === 'workspace'
      ? (shareData.canvases[activeIndex]?.name ?? shareData.name)
      : ''

  const dark = isDarkTheme(viewerSettings.theme)
  const panelBg = getPanelBackground(viewerSettings.theme)
  const fg = dark ? 'text-white' : 'text-black'
  const fgMuted = dark ? 'text-white/60' : 'text-black/50'
  const fgDim = dark ? 'text-white/20' : 'text-black/15'
  const border = dark ? 'border-white/10' : 'border-black/10'
  const tabActive = dark ? 'bg-white/15 text-white' : 'bg-black/8 text-black'
  const tabInactive = dark ? 'text-white/40 hover:text-white/70 hover:bg-white/8' : 'text-black/40 hover:text-black/70 hover:bg-black/5'
  const ghostBtn = dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/8 text-black hover:bg-black/12'

  if (error) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center gap-4 ${fg}`} style={{ background: panelBg }}>
        <p className="text-lg opacity-60">This share link is no longer active.</p>
        <a href="/" className="text-[#3b82f6] text-sm hover:underline">Open drawzil.la</a>
      </div>
    )
  }

  if (!shareData) {
    return <div className="fixed inset-0" style={{ background: panelBg }} />
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 h-12 shrink-0 border-b ${border} backdrop-blur-sm z-10`}
        style={{ background: panelBg }}
      >
        <a href="/" className="flex items-center gap-1.5 select-none" style={{ textDecoration: 'none' }}>
          <span className="text-xl leading-none" style={{ fontFamily: 'Caveat Brush, cursive' }}>
            {([
              { letter: 'd', color: '#3b82f6', rotate: -6 },
              { letter: 'r', color: '#ef4444', rotate: 3 },
              { letter: 'a', color: '#22c55e', rotate: -4 },
              { letter: 'w', color: '#eab308', rotate: 5 },
              { letter: 'z', color: '#ec4899', rotate: -3 },
              { letter: 'i', color: '#f97316', rotate: 4 },
              { letter: 'l', color: '#8b5cf6', rotate: -5 },
              { letter: 'l', color: '#06b6d4', rotate: 3 },
              { letter: 'a', color: '#ef4444', rotate: -4 },
            ] as const).map((l, i) => (
              <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : 1, transform: `rotate(${l.rotate}deg)`, color: l.color }}>
                {l.letter}
              </span>
            ))}
          </span>
          <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.85 }} />
        </a>
        {shareData.type === 'canvas' && <span className={fgDim}>/</span>}
        <span className={`text-[13px] ${fgMuted} truncate max-w-[200px]`}>
          {shareData.type === 'workspace' ? shareData.name : canvasName}
        </span>

        {/* Workspace canvas tabs */}
        {shareData.type === 'workspace' && shareData.canvases.length > 1 && (
          <div className="flex items-center gap-1">
            <span className={fgDim}>/</span>
            {shareData.canvases.map((c, i) => (
              <button
                key={c.id}
                onClick={() => switchCanvas(i)}
                className={`px-2.5 py-1 rounded text-[12px] transition-colors ${i === activeIndex ? tabActive : tabInactive}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {expiresAt && (
          <span className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-400/25 text-yellow-700'}`}>
            {formatExpiry(expiresAt)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <>
              {/* Open CTAs — appear once forked, sit alongside other buttons */}
              {canvasStatus === 'done' && (
                <button onClick={openApp} className="px-3 py-1.5 rounded text-[12px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors">
                  Open canvas in drawzil.la →
                </button>
              )}
              {workspaceStatus === 'done' && (
                <button onClick={openApp} className="px-3 py-1.5 rounded text-[12px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors">
                  Open workspace in drawzil.la →
                </button>
              )}

              {/* Fork workspace — workspace shares only */}
              {shareData.type === 'workspace' && (
                <button
                  onClick={forkWorkspace}
                  disabled={workspaceStatus === 'loading'}
                  className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors disabled:opacity-50 ${ghostBtn}`}
                >
                  {workspaceStatus === 'loading' ? '…' : workspaceStatus === 'error' ? 'Failed' : 'Fork workspace'}
                </button>
              )}

              {/* Fork canvas */}
              {canvasStatus === 'conflict' ? (
                <>
                  <span className={`text-[11px] ${fgMuted}`}>All 9 slots full</span>
                  <button onClick={forkCanvasOverwrite} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                    Replace slot 1
                  </button>
                  <button onClick={downloadCanvas} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                    Download copy
                  </button>
                </>
              ) : canvasStatus === 'error' && canvasLimitHit ? (
                <>
                  <a href="https://unleash.drawzil.la" className="px-3 py-1.5 rounded text-[12px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors">
                    Upgrade →
                  </a>
                  <button onClick={downloadCanvas} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                    Download copy
                  </button>
                  <button onClick={replaceFirstCloudCanvas} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                    Replace canvas
                  </button>
                </>
              ) : (
                <button
                  onClick={forkCanvas}
                  disabled={canvasStatus === 'loading'}
                  className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors disabled:opacity-50 ${canvasStatus === 'done' ? ghostBtn : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}
                >
                  {canvasStatus === 'loading' ? '…' : canvasStatus === 'error' ? 'Failed — retry' : 'Fork canvas'}
                </button>
              )}

              {/* Auth status */}
              {isSignedIn
                ? <UserButton />
                : isSignedIn === false && (
                  <SignInButton mode="modal">
                    <button className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                      Sign in
                    </button>
                  </SignInButton>
                )
              }
          </>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <Canvas
          key={`share-${canvasKey}`}
          canvasIndex={SHARE_SLOT}
          canvasLimit={1}
          lineWidth={2}
          lineColor="#000000"
          dashGap={5}
          gridType={viewerSettings.gridType}
          theme={viewerSettings.theme}
          touchTool="hand"
          activeShape="line"
          shapeFill="solid"
          shapeFillEnabled={false}
          fillOpacity={1}
          shapeDashed={false}
          shapeCorners="rounded"
          textSize="m"
          fontFamily="sans"
          textBold={false}
          textItalic={false}
          textAlign="left"
          pressureSensitivity={false}
          leftClickTool="pan"
          rightClickTool="pan"
          readOnly
        />
        <div className="absolute inset-0 pointer-events-none" style={{ cursor: 'default' }} />
      </div>
    </div>
  )
}
