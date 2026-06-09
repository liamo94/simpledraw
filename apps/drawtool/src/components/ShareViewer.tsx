import { useEffect, useRef, useState } from 'react'
import Canvas from './Canvas'
import { saveStrokes, saveView } from '../canvas/storage'
import { storeImage } from '../canvas/imageStore'
import type { Stroke } from '../canvas/types'
import { isDarkTheme, getPanelBackground } from '../canvas/rendering'
import type { Theme, GridType } from '../hooks/useSettings'

function loadViewerSettings(): { theme: Theme; gridType: GridType; customThemeBg: string } {
  try {
    const raw = localStorage.getItem('drawtool-settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        theme: parsed.theme ?? 'dark',
        gridType: parsed.gridType ?? 'off',
        customThemeBg: parsed.customThemeBg ?? '#1a1040',
      }
    }
  } catch { /* ignore */ }
  return { theme: 'dark', gridType: 'off', customThemeBg: '#1a1040' }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
// Dedicated slot for share viewer - doesn't conflict with user's slots 1–9
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

const SESSION_KEY = (token: string) => `share-access-${token}`

// token and isWorkspace are derived from the URL by App.tsx
export default function ShareViewer({ token, isWorkspace }: { token: string; isWorkspace: boolean }) {
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState(false)
  const [expired, setExpired] = useState(false)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [viewerSettings, setViewerSettings] = useState(loadViewerSettings)
  const shareDataRef = useRef<ShareData | null>(null)
  shareDataRef.current = shareData
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const lastDPressRef = useRef(0)

  async function fetchShare(accessToken?: string) {
    try {
      const url = isWorkspace
        ? `${API_URL}/share/workspace/${token}`
        : `${API_URL}/share/${token}`

      const headers: Record<string, string> = {}
      if (accessToken) headers['X-Access-Token'] = accessToken

      const r = await fetch(url, { headers })
      if (r.status === 410) { setExpired(true); return }
      if (r.status === 401) {
        const body = await r.json() as { password_required?: boolean }
        if (body.password_required) { setPasswordRequired(true); return }
        setError(true); return
      }
      if (!r.ok) { setError(true); return }
      const data = await r.json() as ShareData
      setShareData(data)
      loadSlot(data, 0, isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg))
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY(token))
    fetchShare(stored ?? undefined)
  }, [token, isWorkspace])

  async function handleUnlock() {
    setUnlocking(true)
    setPasswordError(false)
    try {
      const r = await fetch(`${API_URL}/share/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })
      if (r.status === 410) { setExpired(true); setPasswordRequired(false); return }
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string }
        setPasswordError(body.error === 'Incorrect password' || r.status === 401)
        if (body.error !== 'Incorrect password' && r.status !== 401) setError(true)
        return
      }
      const { access_token } = await r.json() as { access_token: string }
      sessionStorage.setItem(SESSION_KEY(token), access_token)
      setPasswordRequired(false)
      fetchShare(access_token)
    } catch {
      setPasswordError(true)
    } finally {
      setUnlocking(false)
    }
  }

  // Re-adapt stroke colours when the viewer theme changes
  useEffect(() => {
    if (!shareDataRef.current) return
    loadSlot(shareDataRef.current, activeIndexRef.current, isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg))
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
    loadSlot(shareData, idx, isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg))
  }

  function triggerDownload(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCanvas() {
    if (!shareData) return
    const entry = shareData.type === 'canvas'
      ? { name: shareData.name, data: shareData.data }
      : shareData.canvases[activeIndex]
    if (!entry) return
    triggerDownload(`${entry.name || 'canvas'}.json`, {
      version: 1,
      strokes: entry.data.strokes,
      ...(entry.name ? { name: entry.name } : {}),
      ...(entry.data.images ? { images: entry.data.images } : {}),
    })
  }

  function downloadWorkspace() {
    if (!shareData || shareData.type !== 'workspace') return
    triggerDownload(`${shareData.name || 'workspace'}.json`, {
      version: 1,
      type: 'workspace',
      canvases: shareData.canvases.map((c, i) => ({
        index: i + 1,
        strokes: c.data.strokes,
        view: c.data.view,
        ...(c.name ? { name: c.name } : {}),
        ...(c.data.images ? { images: c.data.images } : {}),
      })),
    })
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

  const dark = isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg)
  const panelBg = getPanelBackground(viewerSettings.theme, viewerSettings.customThemeBg)
  const fg = dark ? 'text-white' : 'text-black'
  const fgMuted = dark ? 'text-white/60' : 'text-black/50'
  const fgDim = dark ? 'text-white/20' : 'text-black/15'
  const border = dark ? 'border-white/10' : 'border-black/10'
  const tabActive = dark ? 'bg-white/15 text-white' : 'bg-black/8 text-black'
  const tabInactive = dark ? 'text-white/40 hover:text-white/70 hover:bg-white/8' : 'text-black/40 hover:text-black/70 hover:bg-black/5'
  const ghostBtn = dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/8 text-black hover:bg-black/12'

  const logoEl = (size: number) => (
    <span className="leading-none" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: size }}>
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
        <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : (size > 24 ? 2 : 1), transform: `rotate(${l.rotate}deg)`, color: l.color }}>
          {l.letter}
        </span>
      ))}
    </span>
  )

  if (expired) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center gap-6 ${fg}`} style={{ background: panelBg }}>
        <a href="/" className="flex items-center gap-2 select-none" style={{ textDecoration: 'none' }}>
          {logoEl(36)}
          <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.85 }} />
        </a>
        <div className="flex flex-col items-center gap-2">
          <p className="text-base opacity-50">This share link has expired.</p>
          <a href="/" className={`text-sm opacity-40 hover:opacity-70 transition-opacity ${fg}`}>Go to drawzil.la →</a>
        </div>
      </div>
    )
  }

  if (passwordRequired) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center gap-6 ${fg}`} style={{ background: panelBg }}>
        <a href="/" className="flex items-center gap-2 select-none" style={{ textDecoration: 'none' }}>
          {logoEl(36)}
          <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.85 }} />
        </a>
        <div className="flex flex-col items-center gap-3" style={{ width: 280 }}>
          <p className={`text-sm ${fgMuted}`}>This canvas is password protected.</p>
          <div className="flex flex-col gap-2 w-full">
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && passwordInput) handleUnlock() }}
              placeholder="Enter password"
              className={`w-full text-sm px-3 py-2 rounded-lg outline-none border ${passwordError ? 'border-red-400/60' : dark ? 'border-white/10' : 'border-black/10'} ${dark ? 'bg-white/8 text-white placeholder:text-white/25' : 'bg-black/5 text-black placeholder:text-black/30'}`}
            />
            {passwordError && <p className="text-xs text-red-400">Incorrect password.</p>}
            <button
              disabled={!passwordInput || unlocking}
              onClick={handleUnlock}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${dark ? 'bg-white/12 hover:bg-white/18 text-white/80' : 'bg-black/8 hover:bg-black/13 text-black/70'} disabled:opacity-40`}
            >
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center gap-6 ${fg}`} style={{ background: panelBg }}>
        <a href="/" className="flex items-center gap-2 select-none" style={{ textDecoration: 'none' }}>
          {logoEl(36)}
          <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.85 }} />
        </a>
        <div className="flex flex-col items-center gap-2">
          <p className="text-base opacity-50">This share link is no longer active.</p>
          <a href="/" className={`text-sm opacity-40 hover:opacity-70 transition-opacity ${fg}`}>Go to drawzil.la →</a>
        </div>
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
          {logoEl(20)}
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
          <button
            onClick={downloadCanvas}
            className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}
          >
            Download canvas
          </button>
          {shareData.type === 'workspace' && (
            <button
              onClick={downloadWorkspace}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}
            >
              Download workspace
            </button>
          )}
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
