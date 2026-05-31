import { useState, useEffect, useRef } from 'react'
import { useAuth, useUser, SignInButton, UserButton } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.drawzil.la'

type SubStatus = {
  plan: string
  subscription: { status: string; cancelAt: number | null } | null
  startedAt: number | null
} | null

type SharedCanvas = {
  token: string; type: string
  canvas_id: string; canvas_name: string
  workspace_id: string; workspace_name: string
}
type SharedWorkspace = { id: string; name: string; token: string }
type SharedItems = { workspaces: SharedWorkspace[]; canvases: SharedCanvas[] }

const FEATURES: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="4" height="4" rx="0.8" /><rect x="6" y="1" width="4" height="4" rx="0.8" /><rect x="11" y="1" width="4" height="4" rx="0.8" />
        <rect x="1" y="6" width="4" height="4" rx="0.8" /><rect x="6" y="6" width="4" height="4" rx="0.8" /><rect x="11" y="6" width="4" height="4" rx="0.8" />
        <rect x="1" y="11" width="4" height="4" rx="0.8" /><rect x="6" y="11" width="4" height="4" rx="0.8" /><rect x="11" y="11" width="4" height="4" rx="0.8" />
      </svg>
    ),
    title: 'All 9 canvases unlocked',
    description: 'Access all 9 canvas slots per workspace, not just 3.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5.5" width="14" height="8.5" rx="1.5" />
        <path d="M4 5.5V4A1.5 1.5 0 0 1 5.5 2.5h5A1.5 1.5 0 0 1 12 4v1.5" />
      </svg>
    ),
    title: 'Unlimited workspaces',
    description: 'Organise your work into as many workspaces as you like.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v8M5 7l3 3 3-3" />
        <path d="M2 12v.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V12" />
      </svg>
    ),
    title: 'Clean exports',
    description: 'Download PNG and SVG without the drawzilla watermark.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5a3.2 3.2 0 0 0 4.5 0l1.5-1.5a3.2 3.2 0 0 0-4.5-4.5L7.2 4.3" />
        <path d="M9.5 6.5a3.2 3.2 0 0 0-4.5 0L3.5 8a3.2 3.2 0 0 0 4.5 4.5L8.8 11.7" />
      </svg>
    ),
    title: 'Share permanent live links',
    description: 'Share any canvas as a read-only link. Anyone can view and fork it.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1.5L3.5 9H8L7 14.5l5.5-7H9L10 1.5z" />
      </svg>
    ),
    title: 'Priority support',
    description: 'Get help faster when something goes wrong.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.5 8a5.5 5.5 0 0 1-9.9 3.3" />
        <path d="M2.5 8a5.5 5.5 0 0 1 9.9-3.3" />
        <path d="M13.5 4.5V8H10M2.5 11.5V8H6" />
      </svg>
    ),
    title: 'Sync everywhere',
    description: 'Your canvases follow you — open drawzilla on any device.',
  },
]

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="rounded-xl p-5 border transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(57,255,20,0.22)'
        e.currentTarget.style.background = 'rgba(57,255,20,0.03)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
        style={{ background: 'rgba(57,255,20,0.1)', color: '#39ff14' }}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold text-white/90 mb-1.5">{title}</div>
      <div className="text-xs text-white/40 leading-relaxed">{description}</div>
    </div>
  )
}

function formatSince(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function useSubStatus() {
  const { isSignedIn, isLoaded } = useUser()
  const { getToken } = useAuth()

  const { data: status, isLoading } = useQuery<SubStatus>({
    queryKey: ['subStatus'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) return null
      const res = await fetch(`${API_URL}/stripe/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.json()
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 60_000,
  })

  return { status: status ?? null, loading: !isLoaded || isLoading }
}

function useSharedItems() {
  const { isSignedIn, isLoaded } = useUser()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: items, isLoading } = useQuery<SharedItems>({
    queryKey: ['sharedItems'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) return { workspaces: [], canvases: [] }
      const res = await fetch(`${API_URL}/workspaces/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.json()
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['sharedItems'] })

  return { items: items ?? null, loading: isLoading, refetch }
}

import { DrawzillaLogo, LOGO_LETTERS, DRAW_URL } from './Logo'

function Nav({ scrolled }: { scrolled: boolean }) {
  const { isSignedIn } = useUser()
  return (
    <nav
      className={`fixed top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-4 transition-transform duration-300 ${scrolled ? 'translate-y-0' : '-translate-y-full'}`}
      style={{ background: 'rgba(6,6,15,0.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <DrawzillaLogo iconSize={32} fontSize="1.5rem" />
      <div className="flex items-center gap-3">
        <a href={DRAW_URL} className="text-xs text-white/40 hover:text-white/70 transition-colors">
          Open app
        </a>
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <SignInButton mode="modal">
            <button className="text-xs px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 hover:text-white transition-colors">
              Sign in
            </button>
          </SignInButton>
        )}
      </div>
    </nav>
  )
}

function CtaButton({ hideIfPro = false }: { hideIfPro?: boolean }) {
  const { isSignedIn } = useUser()
  const { getToken } = useAuth()
  const { status, loading } = useSubStatus()
  const [working, setWorking] = useState(false)

  async function handleCheckout() {
    setWorking(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          successUrl: `${DRAW_URL}?unleashed=1`,
          cancelUrl: window.location.href,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json() as { url?: string }
      if (!data.url) throw new Error('No redirect URL')
      window.location.href = data.url
    } catch {
      alert('Couldn\'t start checkout — please try again or contact liam@drawzil.la')
    } finally {
      setWorking(false)
    }
  }

  async function handlePortal() {
    setWorking(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json() as { url?: string }
      if (!data.url) throw new Error('No redirect URL')
      window.location.href = data.url
    } catch {
      alert('Couldn\'t open billing portal — please try again or contact liam@drawzil.la')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div style={{ height: '44px' }} />

  const isUnleashed = status?.plan === 'pro'

  if (isSignedIn && isUnleashed) {
    if (hideIfPro) return <div style={{ height: '44px' }} />
    return (
      <button
        onClick={handlePortal}
        disabled={working}
        className="text-xs px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 hover:text-white/80 transition-colors disabled:opacity-50"
      >
        {working ? 'Loading…' : 'Manage subscription'}
      </button>
    )
  }

  if (isSignedIn) {
    return (
      <button
        onClick={handleCheckout}
        disabled={working}
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #39ff14, #22cc10)', color: '#0a1a04' }}
      >
        {working ? 'Loading…' : 'Get Unleashed — £2.99/mo'}
      </button>
    )
  }

  return (
    <SignInButton mode="modal">
      <button
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #39ff14, #22cc10)', color: '#0a1a04' }}
      >
        Get Unleashed — £2.99/mo
      </button>
    </SignInButton>
  )
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-white/25 hover:text-white/70 hover:bg-white/8 cursor-pointer"
      title="Copy link"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#39ff14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <path d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1H2.5A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4" />
        </svg>
      )}
    </button>
  )
}

function TypeBadge({ type }: { type: 'live' | 'snap' | 'ws' }) {
  const styles: Record<string, string> = {
    live: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    snap: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ws:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  const label = { live: 'live', snap: 'snap', ws: 'workspace' }[type]
  return (
    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[type]}`}>
      {label}
    </span>
  )
}

function ProfileSection({ startedAt }: { startedAt: number | null }) {
  const { getToken } = useAuth()
  const { items, loading, refetch } = useSharedItems()
  const [revoking, setRevoking] = useState<Set<string>>(new Set())

  async function revokeCanvas(canvasId: string, token: string) {
    const key = `canvas-${token}`
    setRevoking(s => new Set(s).add(key))
    try {
      const authToken = await getToken()
      await fetch(`${API_URL}/canvases/${canvasId}/share/${token}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      refetch()
    } finally {
      setRevoking(s => { const n = new Set(s); n.delete(key); return n })
    }
  }

  async function revokeWorkspace(workspaceId: string) {
    const key = `ws-${workspaceId}`
    setRevoking(s => new Set(s).add(key))
    try {
      const authToken = await getToken()
      await fetch(`${API_URL}/workspaces/${workspaceId}/share`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      refetch()
    } finally {
      setRevoking(s => { const n = new Set(s); n.delete(key); return n })
    }
  }

  const totalShared = (items?.workspaces.length ?? 0) + (items?.canvases.length ?? 0)

  return (
    <section className="max-w-2xl mx-auto px-6 pb-16">
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(15,15,30,0.97)',
          borderColor: 'rgba(57,255,20,0.12)',
          boxShadow: '0 0 60px rgba(57,255,20,0.05), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(57,255,20,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(57,255,20,0.12)', boxShadow: '0 0 12px rgba(57,255,20,0.2)' }}>
              <span style={{ color: '#39ff14', fontSize: 14 }}>✦</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">
                {startedAt ? `Unleashed since ${formatSince(startedAt)}` : 'Unleashed'}
              </div>
              <div className="text-[11px] text-white/30 mt-0.5">Pro plan · active</div>
            </div>
          </div>
          <CtaButton hideIfPro={false} />
        </div>

        {/* Shared items */}
        <div className="px-5 py-4">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
            Shared publicly
          </div>

          {loading ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : totalShared === 0 ? (
            <div className="py-6 text-center">
              <div className="text-white/20 text-sm">No public shares yet.</div>
              <div className="text-white/12 text-xs mt-1">Share a canvas from the drawzilla app to see it here.</div>
            </div>
          ) : (
            <div className="scrollbar-thin space-y-1 overflow-y-auto" style={{ maxHeight: '21rem' }}>
              {items?.workspaces.map(ws => (
                <div
                  key={ws.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <TypeBadge type="ws" />
                  <span className="text-sm text-white/75 truncate flex-1">{ws.name}</span>
                  <CopyButton url={`${DRAW_URL}/s/w/${ws.token}`} />
                  <button
                    onClick={() => revokeWorkspace(ws.id)}
                    disabled={revoking.has(`ws-${ws.id}`)}
                    className="shrink-0 text-[11px] text-white/25 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    {revoking.has(`ws-${ws.id}`) ? 'Stopping…' : 'Unshare'}
                  </button>
                </div>
              ))}

              {items?.canvases.map(c => (
                <div
                  key={c.token}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <TypeBadge type={c.type === 'live' ? 'live' : 'snap'} />
                  <span className="text-sm text-white/75 truncate flex-1">{c.canvas_name}</span>
                  <span className="text-[11px] text-white/25 shrink-0 hidden sm:block">{c.workspace_name}</span>
                  <CopyButton url={`${DRAW_URL}/s/${c.token}`} />
                  <button
                    onClick={() => revokeCanvas(c.canvas_id, c.token)}
                    disabled={revoking.has(`canvas-${c.token}`)}
                    className="shrink-0 text-[11px] text-white/25 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    {revoking.has(`canvas-${c.token}`) ? 'Stopping…' : 'Unshare'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const { isSignedIn, isLoaded } = useUser()
  const { status, loading: statusLoading } = useSubStatus()
  const isUnleashed = status?.plan === 'pro'
  const planKnown = isLoaded && !statusLoading
  const heroLogoRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [evoPhase, setEvoPhase] = useState<'normal' | 'glow' | 'flash' | 'unleashed'>('normal')

  useEffect(() => {
    const t1 = setTimeout(() => setEvoPhase('glow'),      1200)
    const t2 = setTimeout(() => setEvoPhase('flash'),     2400)
    const t3 = setTimeout(() => setEvoPhase('unleashed'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  useEffect(() => {
    const el = heroLogoRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen text-white" style={{ background: '#06060f' }}>
      <Nav scrolled={scrolled} />

      {/* Hero */}
      <section className="min-h-[92vh] flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-6 pt-24 pb-16 max-w-6xl mx-auto">

        {/* Text */}
        <div className="relative flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-lg">
          <div ref={heroLogoRef} className="mb-6">
            <DrawzillaLogo iconSize={64} fontSize="3.5rem" letterGap={2} />
          </div>

          <div
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-5 border"
            style={{ borderColor: 'rgba(57,255,20,0.3)', color: '#a8ff87', background: 'rgba(57,255,20,0.08)' }}
          >
            <span style={{ color: '#39ff14' }}>✦</span>
            drawzilla Unleashed
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
            Your canvas,{' '}
            <span className="block" style={{ color: '#39ff14' }}>unleashed.</span>
          </h1>

          <p className="text-white/50 text-base max-w-sm mb-10 leading-relaxed">
            Unlimited canvases, clean exports, permanent share links, and sync across every device.
          </p>

          <CtaButton hideIfPro />
          <p className="mt-4 text-xs text-white/25" style={{ visibility: planKnown && !isUnleashed ? 'visible' : 'hidden' }}>Cancel anytime. No lock-in.</p>
        </div>

        {/* Mascot — evolves once on load */}
        <div style={{ position: 'relative', width: '360px', height: '400px', flexShrink: 0 }}>
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
              <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 3 0" />
              </filter>
            </defs>
          </svg>

          {/* Normal mascot — shown until flash */}
          {evoPhase !== 'unleashed' && (
            <img
              src="/mascot-normal.png"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 'calc(50% - 125px)',
                width: '250px',
                height: '280px',
                objectFit: 'contain',
                opacity: evoPhase === 'flash' ? 0 : 1,
                transition: evoPhase === 'flash' ? 'opacity 0.1s ease, filter 0.1s ease' : 'opacity 0.15s ease, filter 0.4s ease',
                filter: evoPhase === 'glow'
                  ? 'url(#remove-white-bg) drop-shadow(0 0 16px rgba(57,255,20,0.9)) brightness(1.2)'
                  : evoPhase === 'flash'
                  ? 'brightness(6) saturate(0)'
                  : 'url(#remove-white-bg)',
                animation: evoPhase === 'glow'
                  ? 'evolve-shake 0.2s ease-in-out infinite'
                  : 'float-calm 6s ease-in-out infinite',
              }}
            />
          )}

          {/* Roaring mascot — bursts in after flash, then floats */}
          {evoPhase === 'unleashed' && (
            <img
              src="/mascot.png"
              alt="drawzilla mascot"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                animation: 'evolve-burst 1.2s ease-out, float-energetic 3s ease-in-out 1.2s infinite, evolve-glow 1.5s ease-out forwards',
              }}
            />
          )}
        </div>
      </section>

      {/* Profile section — pro users only */}
      {planKnown && isSignedIn && isUnleashed && (
        <ProfileSection startedAt={status?.startedAt ?? null} />
      )}

      {/* Features */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <p className="text-center text-[11px] text-white/25 uppercase tracking-widest mb-8">What's included</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* Pricing — hidden until plan is known and for existing subscribers */}
      {planKnown && !isUnleashed && (
        <section className="flex justify-center px-6 pb-32">
          <div
            className="w-full max-w-xs rounded-2xl p-6 border text-center"
            style={{ background: 'rgba(57,255,20,0.06)', borderColor: 'rgba(57,255,20,0.2)' }}
          >
            <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Unleashed</div>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-4xl font-bold">£2.99</span>
              <span className="text-white/40 text-sm mb-1.5">/mo</span>
            </div>
            <p className="text-xs text-white/30 mb-6">Billed monthly. Cancel anytime via your account portal. No refunds for partial months.</p>

            <div className="flex flex-col gap-2 text-left mb-6">
              {[
                'All 9 canvases unlocked',
                'Unlimited workspaces',
                'Clean PNG & SVG export',
                'Share links',
                'Priority support',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-white/60">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="#39ff14" strokeOpacity="0.5" />
                    <path d="M3.5 6L5.5 8L8.5 4" stroke="#39ff14" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>

            <CtaButton />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/6 px-6 py-6 flex items-center justify-between text-xs text-white/25">
        <a href={DRAW_URL} className="flex items-center gap-1.5 no-underline">
          <img src="/drawzilla-simplifed.svg" alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Caveat Brush, cursive', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
            {LOGO_LETTERS.map((l, i) => (
              <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : 1, transform: `rotate(${l.rotate}deg)`, color: l.color }}>{l.letter}</span>
            ))}
          </span>
        </a>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-white/50 transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white/50 transition-colors">Terms</a>
          <a href="mailto:liam@drawzil.la" className="hover:text-white/50 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  )
}
