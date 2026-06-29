import { useEffect, useRef, useState } from 'react'
import Canvas from './Canvas'
import { saveStrokes, saveView } from '../canvas/storage'
import { storeImage, getImageEl } from '../canvas/imageStore'
import type { Stroke, Slide } from '../canvas/types'
import { isDarkTheme, getPanelBackground, getBackgroundColor, generateSlideThumbnail } from '../canvas/rendering'
import type { Theme, GridType } from '../hooks/useSettings'

// Compute the letterboxed/pillarboxed display rect for a slide's aspect ratio
// within the current screen. On a narrow mobile screen this prevents showing
// unintended canvas content outside the intended slide area.
function computeDisplayRect(refSize?: { width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const sw = window.innerWidth
  const sh = window.innerHeight
  // Default to 16:9 when refSize is missing (older slides)
  const ref = refSize ?? { width: 16, height: 9 }
  const screenAspect = sw / sh
  const contentAspect = ref.width / ref.height
  // Skip boxing if aspects are close enough (within 5%) — no meaningful bars to add
  if (Math.abs(screenAspect - contentAspect) / contentAspect < 0.05) {
    return { x: 0, y: 0, width: sw, height: sh }
  }
  if (screenAspect < contentAspect) {
    // Screen narrower than content (e.g. mobile portrait with 16:9 slide): letterbox top/bottom
    const dh = sw / contentAspect
    return { x: 0, y: (sh - dh) / 2, width: sw, height: dh }
  } else {
    // Screen wider or equal: pillarbox left/right
    const dw = sh * contentAspect
    return { x: (sw - dw) / 2, y: 0, width: dw, height: sh }
  }
}

// Mirror of App.tsx resolveSlideView — adjusts view for the viewer's actual screen size.
// Slides store worldCenter + refSize so the same visual framing is reproduced regardless
// of the device the slide was captured on.
function resolveSlideView(slide: Slide): { x: number; y: number; scale: number } {
  if (!slide.worldCenter) return slide.view
  const rect = computeDisplayRect(slide.refSize)
  // With refSize: scale to fill the display rect proportionally.
  // Without refSize: keep original zoom, just center worldCenter in the display rect.
  const scale = slide.refSize
    ? slide.view.scale * Math.min(rect.width / slide.refSize.width, rect.height / slide.refSize.height)
    : slide.view.scale
  const x = rect.x + rect.width / 2 - slide.worldCenter.x * scale
  const y = rect.y + rect.height / 2 - slide.worldCenter.y * scale
  if (!isFinite(x) || !isFinite(y) || !isFinite(scale) || scale <= 0) return slide.view
  return { x, y, scale }
}

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

type CanvasData = { strokes: Stroke[]; view: { x: number; y: number; scale: number }; savedDark?: boolean; savedTheme?: string; savedCustomThemeBg?: string; images?: Record<string, string>; slides?: Slide[] }

type CanvasEntry = {
  id: string
  name: string
  position: number
  data: CanvasData
}

type ShareData =
  | { type: 'canvas'; name: string; data: CanvasData; expires_at?: number | null }
  | { type: 'workspace'; name: string; canvases: CanvasEntry[]; slides?: Slide[]; expires_at?: number | null; has_password?: boolean }
  | { type: 'presentation'; name: string; canvases: CanvasEntry[]; slides: Slide[] }

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

// Set viewer theme to match the canvas's saved theme, falling back to dark/light polarity.
// This ensures the share viewer defaults to showing the canvas as the creator intended,
// rather than using the viewer's own local preferences.
function deriveViewerTheme(
  canvasData: CanvasData | undefined,
  current: { theme: Theme; gridType: GridType; customThemeBg: string }
): { theme: Theme; gridType: GridType; customThemeBg: string } {
  if (!canvasData) return current
  if (canvasData.savedTheme) {
    const t = canvasData.savedTheme as Theme
    const customThemeBg = t === 'custom' && canvasData.savedCustomThemeBg
      ? canvasData.savedCustomThemeBg
      : current.customThemeBg
    return { ...current, theme: t, customThemeBg }
  }
  if (canvasData.savedDark !== undefined) {
    return { ...current, theme: canvasData.savedDark ? 'dark' : 'white' }
  }
  return current
}

const SESSION_KEY = (token: string) => `share-access-${token}`

// token and isWorkspace/isPresentation are derived from the URL by main.tsx
export default function ShareViewer({ token, isWorkspace, isPresentation, embedded }: { token: string; isWorkspace: boolean; isPresentation?: boolean; embedded?: boolean }) {
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
  const [presenting, setPresenting] = useState(false)
  const [presentIndex, setPresentIndex] = useState(0)
  const [showSidebar, setShowSidebar] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false)
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [generatedThumbnails, setGeneratedThumbnails] = useState<Record<string, string>>({})
  const shareDataRef = useRef<ShareData | null>(null)
  shareDataRef.current = shareData
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const presentIndexRef = useRef(presentIndex)
  presentIndexRef.current = presentIndex
  const presentingRef = useRef(presenting)
  presentingRef.current = presenting
  const viewerSettingsRef = useRef(viewerSettings)
  viewerSettingsRef.current = viewerSettings
  const lastDPressRef = useRef(0)
  // Tracks the resolved view last written to slot 10 so the theme-change effect can
  // re-apply the correct (screen-adjusted) view rather than the raw stored slide view.
  const currentSlideViewRef = useRef<{ x: number; y: number; scale: number } | null>(null)

  function bumpControls() {
    setControlsVisible(true)
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current)
    controlsHideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500)
  }

  useEffect(() => () => { if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current) }, [])

  // Generate thumbnails in background after share data loads
  useEffect(() => {
    if (!shareData) return
    const viewerIsDark = isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg)
    let cancelled = false
    async function gen() {
      const slides = shareData!.type === 'canvas'
        ? (shareData!.data.slides ?? [])
        : shareData!.type === 'presentation' || shareData!.type === 'workspace'
          ? (shareData!.slides ?? [])
          : []
      for (const slide of slides) {
        if (cancelled || slide.thumbnail) continue
        const canvases = (shareData! as { canvases: CanvasEntry[] }).canvases ?? []
        const canvasEntry = shareData!.type === 'canvas'
          ? null
          : (slide.canvasId ? canvases.find(c => c.id === slide.canvasId) : null) ?? canvases.find(c => c.position === slide.canvasIndex)
        const canvasData = shareData!.type === 'canvas' ? shareData!.data : canvasEntry?.data
        if (!canvasData) continue
        if (canvasData.images) {
          await Promise.all(
            Object.entries(canvasData.images).map(([id, url]) =>
              getImageEl(id) ? Promise.resolve() : storeImage(id, url)
            )
          )
        }
        if (cancelled) break
        const strokes = adaptStrokes(canvasData, viewerIsDark)
        const thumb = generateSlideThumbnail(strokes as Stroke[], slide.view, viewerIsDark, 480, 270, undefined, slide.refSize?.width)
        if (thumb) setGeneratedThumbnails(prev => ({ ...prev, [slide.id]: thumb }))
        await new Promise<void>(r => setTimeout(r, 30))
      }
    }
    gen()
    return () => { cancelled = true }
  }, [shareData, viewerSettings.theme, viewerSettings.customThemeBg])

  async function fetchShare(accessToken?: string) {
    try {
      const url = isPresentation
        ? `${API_URL}/share/presentation/${token}`
        : isWorkspace
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
      const firstCanvas = data.type === 'canvas' ? data.data : data.canvases[0]?.data
      const effectiveSettings = deriveViewerTheme(firstCanvas, viewerSettings)
      if (data.type === 'presentation' && data.slides.length > 0) {
        const firstSlide = data.slides[0]
        let canvasIdx = firstSlide.canvasId ? data.canvases.findIndex(c => c.id === firstSlide.canvasId) : -1
        if (canvasIdx === -1 && firstSlide.canvasIndex != null) canvasIdx = data.canvases.findIndex(c => c.position === firstSlide.canvasIndex)
        // Await the slot load before applying the theme change. If we call setViewerSettings
        // first, the theme-change effect fires during the storeImage await gap (while
        // presenting=false), races with this loadSlot, and overwrites slot 10 with the
        // canvas's last-saved R2 view instead of the slide's view.
        await loadSlot(data, canvasIdx, isDarkTheme(effectiveSettings.theme, effectiveSettings.customThemeBg), resolveSlideView(firstSlide))
        // Now apply theme + presenting in one batch so the theme effect fires with presenting=true,
        // and its viewOverride fallback (presentingRef) correctly picks up the current slide view.
        if (effectiveSettings !== viewerSettings) setViewerSettings(effectiveSettings)
        setActiveIndex(Math.max(0, canvasIdx))
        setPresenting(true)
        setPresentIndex(0)
      } else {
        if (effectiveSettings !== viewerSettings) setViewerSettings(effectiveSettings)
        loadSlot(data, 0, isDarkTheme(effectiveSettings.theme, effectiveSettings.customThemeBg))
      }
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY(token))
    fetchShare(stored ?? undefined)
  }, [token, isWorkspace, isPresentation])

  async function handleUnlock() {
    setUnlocking(true)
    setPasswordError(false)
    try {
      const unlockUrl = isPresentation
        ? `${API_URL}/share/presentation/${token}/unlock`
        : isWorkspace
          ? `${API_URL}/share/workspace/${token}/unlock`
          : `${API_URL}/share/${token}/unlock`
      const r = await fetch(unlockUrl, {
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

  // Re-adapt stroke colours when the viewer theme changes.
  // When presenting, re-apply the most recently resolved slide view (currentSlideViewRef)
  // so colour adaptation doesn't jump back to the canvas's R2-stored view.
  useEffect(() => {
    if (!shareDataRef.current) return
    const viewOverride = currentSlideViewRef.current ?? undefined
    loadSlot(shareDataRef.current, activeIndexRef.current, isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg), viewOverride)
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

  const allSlides: Slide[] = shareData?.type === 'canvas'
    ? (shareData.data.slides ?? [])
    : (shareData?.type === 'workspace' ? (shareData.slides ?? []) : shareData?.type === 'presentation' ? shareData.slides : [])
  const allSlidesRef = useRef<Slide[]>([])
  allSlidesRef.current = allSlides

  function navigateSlide(idx: number) {
    const slide = allSlidesRef.current[idx]
    if (!slide) return
    setPresentIndex(idx)
    const resolvedView = resolveSlideView(slide)
    const sd = shareDataRef.current
    if (sd?.type === 'workspace' || sd?.type === 'presentation') {
      // Resolve canvas index: prefer canvasId match, fall back to canvasIndex/position for local slides
      let canvasIdx = slide.canvasId ? sd.canvases.findIndex(c => c.id === slide.canvasId) : -1
      if (canvasIdx === -1 && slide.canvasIndex != null) {
        canvasIdx = sd.canvases.findIndex(c => c.position === slide.canvasIndex)
      }
      if (canvasIdx === -1) {
        currentSlideViewRef.current = resolvedView
        window.dispatchEvent(new CustomEvent('drawtool:navigate-slide', { detail: resolvedView }))
        return
      }
      const settings = viewerSettingsRef.current
      const viewerIsDark = isDarkTheme(settings.theme, settings.customThemeBg)
      if (canvasIdx !== activeIndexRef.current) {
        setIsLoadingCanvas(true)
        setActiveIndex(canvasIdx)
        loadSlot(sd, canvasIdx, viewerIsDark, resolvedView).then(() => {
          // Wait two rAF cycles so the browser paints the new canvas before the cover disappears
          requestAnimationFrame(() => requestAnimationFrame(() => setIsLoadingCanvas(false)))
        })
      } else {
        currentSlideViewRef.current = resolvedView
        window.dispatchEvent(new CustomEvent('drawtool:navigate-slide', { detail: resolvedView }))
      }
    } else {
      currentSlideViewRef.current = resolvedView
      window.dispatchEvent(new CustomEvent('drawtool:navigate-slide', { detail: resolvedView }))
    }
  }

  // Re-navigate on resize/orientation-change so the letterbox view stays correct
  useEffect(() => {
    if (!presenting) return
    const onResize = () => navigateSlide(presentIndexRef.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [presenting])

  // Keyboard nav in presentation mode
  useEffect(() => {
    if (!presenting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); bumpControls(); navigateSlide(Math.min(allSlidesRef.current.length - 1, presentIndex + 1)) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); bumpControls(); navigateSlide(Math.max(0, presentIndex - 1)) }
      else if (e.key === 'Escape' && !isPresentation) { e.stopPropagation(); setPresenting(false) }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [presenting, presentIndex])

  async function loadSlot(data: ShareData, idx: number, viewerIsDark: boolean, viewOverride?: { x: number; y: number; scale: number }) {
    const canvasData = data.type === 'canvas' ? data.data : data.canvases[idx]?.data
    if (!canvasData) {
      // Clear stale slot data so Canvas doesn't show content from a previous share visit
      saveStrokes([], SHARE_SLOT)
      saveView({ x: 0, y: 0, scale: 1 }, SHARE_SLOT)
      setCanvasKey(k => k + 1)
      return
    }
    // Write strokes and view synchronously BEFORE awaiting image storage.
    // storeImage (IDB write + HTMLImageElement decode) is genuinely async and takes
    // real time. If we write after the await, any component mount or effect that fires
    // during the gap reads stale slot-10 data. Writing first guarantees slot 10 is
    // correct before anything else can read it, regardless of async ordering.
    const effectiveView = viewOverride ?? canvasData.view
    if (viewOverride) currentSlideViewRef.current = viewOverride
    saveStrokes(adaptStrokes(canvasData, viewerIsDark), SHARE_SLOT)
    saveView(effectiveView, SHARE_SLOT)
    setCanvasKey(k => k + 1)
    if (canvasData.images) {
      await Promise.all(
        Object.entries(canvasData.images).map(([id, url]) => storeImage(id, url))
      )
    }
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

  const expiresAt = shareData && shareData.type !== 'presentation' ? (shareData.expires_at ?? null) : null

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
    : (shareData?.type === 'workspace' || shareData?.type === 'presentation')
      ? (shareData.canvases[activeIndex]?.name ?? shareData.name)
      : ''

  const dark = isDarkTheme(viewerSettings.theme, viewerSettings.customThemeBg)
  const panelBg = getPanelBackground(viewerSettings.theme, viewerSettings.customThemeBg)
  const fg = dark ? 'text-white' : 'text-black'
  const fgMuted = dark ? 'text-white/60' : 'text-black/50'
  const fgDim = dark ? 'text-white/20' : 'text-black/15'
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
          <p className={`text-sm ${fgMuted}`}>This {isWorkspace ? 'workspace' : 'canvas'} is password protected.</p>
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

  if (!shareData || (isPresentation && !presenting)) {
    return <div className="fixed inset-0" style={{ background: panelBg }} />
  }

  const borderCol = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'

  const slidesSidebar = ({ position, zIndex }: { position: 'absolute'; zIndex: number }) => (
    <div className="right-0 top-0 bottom-0 flex flex-col overflow-y-auto" style={{ position, zIndex, width: 280, background: panelBg, borderLeft: `1px solid ${borderCol}`, backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${borderCol}` }}>
        <span className="flex-1 select-none" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: 18, color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)', letterSpacing: '0.02em' }}>
          Presentation
        </span>
        <span className="text-[11px]" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
          {allSlides.length} {allSlides.length === 1 ? 'slide' : 'slides'}
        </span>
        <button
          onClick={() => setShowSidebar(false)}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        {allSlides.map((slide, i) => {
          const isCurrent = i === presentIndex
          return (
            <button
              key={slide.id}
              onClick={() => { if (!presentingRef.current) { setPresenting(true); bumpControls() } navigateSlide(i) }}
              className="rounded-xl overflow-hidden text-left transition-all"
              style={{
                background: isCurrent ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)') : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                outline: isCurrent ? `2px solid ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'}` : 'none',
                outlineOffset: 0,
              }}
            >
              <div className="relative w-full" style={{ aspectRatio: '16/9', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                {(slide.thumbnail || generatedThumbnails[slide.id])
                  ? <img src={slide.thumbnail || generatedThumbnails[slide.id]} className="w-full h-full object-cover" draggable={false} style={{ display: 'block' }} />
                  : <div className="w-full h-full flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="16" height="12" rx="2"/><circle cx="7" cy="8.5" r="1.5"/><polyline points="2 14 6 10 9 13 12 10 18 14"/></svg></div>}
                <span className="absolute top-1 left-1 text-[9px] tabular-nums px-1 py-px rounded font-medium" style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.9)' }}>{i + 1}</span>
              </div>
              <div className="px-2 py-1.5"><span className="text-[11px] truncate block" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>{slide.name}</span></div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const navArrow = (dir: 'prev' | 'next', onClick: () => void, disabled: boolean) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-xl transition-all select-none disabled:opacity-20 disabled:pointer-events-none"
      style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'; (e.currentTarget as HTMLElement).style.color = dark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)' } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
    >
      {dir === 'prev'
        ? <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 4 7 10 13 16"/></svg>
        : <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 4 13 10 7 16"/></svg>
      }
    </button>
  )

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Header — hidden in embed mode and when actively presenting */}
      {!embedded && !(isPresentation && presenting) && (
        <div
          className={`flex items-center gap-3 px-4 h-12 shrink-0 border-b backdrop-blur-sm z-10`}
          style={{ background: panelBg, borderColor: borderCol }}
        >
          <a href="/" className="flex items-center gap-1.5 select-none" style={{ textDecoration: 'none' }}>
            {logoEl(20)}
            <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.85 }} />
          </a>
          {shareData.type === 'canvas' && <span className={fgDim}>/</span>}
          <span className={`text-[13px] ${fgMuted} truncate max-w-[200px]`}>
            {shareData.type === 'workspace' ? shareData.name : canvasName}
          </span>

          {/* Workspace canvas tabs — hidden for presentation-only shares */}
          {shareData.type === 'workspace' && !isPresentation && shareData.canvases.length > 1 && (
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

          <div className="ml-auto flex items-center gap-2">
            {expiresAt && (
              <span className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-400/25 text-yellow-700'}`}>
                {formatExpiry(expiresAt)}
              </span>
            )}
            {allSlides.length > 0 && (
              <button
                onClick={() => setShowSidebar(s => !s)}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${showSidebar ? tabActive : ghostBtn}`}
                title="Slides"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <rect x="2" y="3" width="16" height="11" rx="1.5"/><line x1="7" y1="17" x2="13" y2="17"/><line x1="10" y1="14" x2="10" y2="17"/>
                </svg>
              </button>
            )}
            {allSlides.length > 0 && (
              <button
                onClick={() => { setPresenting(true); bumpControls(); navigateSlide(0) }}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}
              >
                ▶ Present
              </button>
            )}
            {!isPresentation && (
              <>
                <button onClick={downloadCanvas} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                  Download canvas
                </button>
                {shareData.type === 'workspace' && (
                  <button onClick={downloadWorkspace} className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${ghostBtn}`}>
                    Download workspace
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Canvas + overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* pointer-events:none when presenting so the overlay captures all clicks */}
        <div style={{ pointerEvents: presenting ? 'none' : undefined }}>
        <Canvas
          key={`share-${canvasKey}`}
          canvasIndex={SHARE_SLOT}
          canvasLimit={1}
          lineWidth={2}
          lineColor="#000000"
          dashGap={5}
          gridType={presenting ? 'off' : viewerSettings.gridType}
          theme={viewerSettings.theme}
          customThemeBg={viewerSettings.customThemeBg}
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
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ cursor: 'default' }} />

        {/* Slides sidebar — non-presenting mode only */}
        {showSidebar && !presenting && allSlides.length > 0 && slidesSidebar({ position: 'absolute', zIndex: 30 })}

        {/* Presentation overlay — fixed z-[200] matches App.tsx, guaranteed above canvas */}
        {presenting && allSlides.length > 0 && (() => {
          const slide = allSlides[presentIndex]
          const hasPrev = presentIndex > 0
          const hasNext = presentIndex < allSlides.length - 1
          return (
            <div
              className="fixed inset-0 z-[200] pointer-events-auto touch-none"
              onPointerDown={e => { e.stopPropagation(); bumpControls() }}
              onPointerMove={bumpControls}
            >
              {/* Canvas-switch cover — shows theme background while new canvas loads (z:1 so controls stay above it) */}
              {isLoadingCanvas && <div className="absolute inset-0 pointer-events-none" style={{ background: getBackgroundColor(viewerSettings.theme, viewerSettings.customThemeBg), zIndex: 1 }} />}
              {/* Letterbox / pillarbox bars — hide canvas content outside the slide's aspect ratio */}
              {(() => {
                const rect = computeDisplayRect(slide?.refSize)
                if (rect.x === 0 && rect.y === 0) return null
                const barBg = getBackgroundColor(viewerSettings.theme, viewerSettings.customThemeBg)
                return rect.y > 0 ? (
                  <>
                    <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: rect.y, background: barBg, zIndex: 1 }} />
                    <div className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{ height: rect.y, background: barBg, zIndex: 1 }} />
                  </>
                ) : (
                  <>
                    <div className="absolute top-0 bottom-0 left-0 pointer-events-none" style={{ width: rect.x, background: barBg, zIndex: 1 }} />
                    <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ width: rect.x, background: barBg, zIndex: 1 }} />
                  </>
                )
              })()}
              {/* Slides sidebar — inside overlay so it sits above click zones */}
              {showSidebar && slidesSidebar({ position: 'absolute', zIndex: 3 })}
              {/* Left click zone */}
              {hasPrev && <div className="absolute left-0 top-0 bottom-0 w-1/2" style={{ cursor: 'w-resize', zIndex: 2 }} onPointerDown={e => { e.stopPropagation(); e.preventDefault() }} onClick={() => { bumpControls(); navigateSlide(presentIndexRef.current - 1) }} />}
              {/* Right click zone */}
              {hasNext && <div className="absolute right-0 top-0 bottom-0 w-1/2" style={{ cursor: 'e-resize', zIndex: 2 }} onPointerDown={e => { e.stopPropagation(); e.preventDefault() }} onClick={() => { bumpControls(); navigateSlide(presentIndexRef.current + 1) }} />}
              {/* Bottom control bar */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 pointer-events-none transition-opacity duration-300" style={{ opacity: controlsVisible ? 1 : 0, zIndex: 2 }}>
                <div className="pointer-events-auto flex items-center gap-2 px-3 py-2.5 rounded-2xl select-none"
                  style={{ background: panelBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${borderCol}`, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)' }}>
                  {/* Logo */}
                  <a href="https://drawzil.la" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5" style={{ textDecoration: 'none' }}>
                    {logoEl(20)}
                    <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                  </a>
                  <div className="w-px h-5 mx-1" style={{ background: borderCol }} />

                  {navArrow('prev', () => navigateSlide(presentIndex - 1), !hasPrev)}

                  <div className="flex flex-col items-center gap-1 px-2" style={{ minWidth: 80, maxWidth: 200 }}>
                    <div className="flex items-baseline gap-1.5 leading-none w-full">
                      <span className="shrink-0" style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                        {presentIndex + 1}/{allSlides.length}
                      </span>
                      <span className="truncate" style={{ fontFamily: 'Caveat Brush, cursive', fontSize: 18, color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)', letterSpacing: '0.01em' }}>
                        {slide?.name ?? `Slide ${presentIndex + 1}`}
                      </span>
                    </div>
                    {allSlides.length <= 8 ? (
                      <div className="flex items-center gap-1">
                        {allSlides.map((_, i) => (
                          <button key={i} onClick={() => navigateSlide(i)} className="rounded-full transition-all duration-150"
                            style={{ width: i === presentIndex ? 14 : 6, height: 6, background: i === presentIndex ? (dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)') : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)') }} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] tabular-nums" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                        {presentIndex + 1} / {allSlides.length}
                      </span>
                    )}
                  </div>

                  {navArrow('next', () => navigateSlide(presentIndex + 1), !hasNext)}

                  <div className="w-px h-5 mx-1" style={{ background: borderCol }} />

                  {/* Sidebar toggle */}
                  <button
                    onClick={() => setShowSidebar(s => !s)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                    title="Slides"
                    style={{ color: showSidebar ? (dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)') : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'), background: showSidebar ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)') : 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = showSidebar ? (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') : 'transparent' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="16" height="11" rx="1.5"/><line x1="7" y1="17" x2="13" y2="17"/><line x1="10" y1="14" x2="10" y2="17"/>
                    </svg>
                  </button>

                  {/* Exit — hidden for presentation-only shares (no raw canvas to return to) */}
                  {!isPresentation && (
                    <button
                      onClick={() => { setPresenting(false); if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current) }}
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                      title="Exit presentation (Esc)"
                      style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {embedded && (
          <a
            href="https://drawzil.la"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 opacity-60 hover:opacity-90 transition-opacity select-none"
            style={{ textDecoration: 'none', pointerEvents: 'auto' }}
          >
            {logoEl(17)}
            <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          </a>
        )}
      </div>
    </div>
  )
}
