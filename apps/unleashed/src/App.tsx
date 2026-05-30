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

const FEATURES = [
  {
    title: 'All 9 canvases unlocked',
    description: 'Access all 9 canvas slots per workspace, not just 3.',
  },
  {
    title: 'Unlimited workspaces',
    description: 'Organise your work into as many workspaces as you like.',
  },
  {
    title: 'Clean exports',
    description: 'Download PNG and SVG without the drawzilla watermark.',
  },
  {
    title: 'Share links',
    description: 'Share any canvas as a read-only link. Anyone can view and fork it.',
  },
  {
    title: 'Priority support',
    description: 'Get help faster when something goes wrong.',
  },
  {
    title: 'Sync everywhere',
    description: 'Your canvases follow you — open drawzilla on any device.',
  },
]

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
      const { url } = await res.json() as { url: string }
      window.location.href = url
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
      const { url } = await res.json() as { url: string }
      window.location.href = url
    } finally {
      setWorking(false)
    }
  }

  if (loading) return null

  const isUnleashed = status?.plan === 'pro'

  if (isSignedIn && isUnleashed) {
    if (hideIfPro) return null
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
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #39ff14, #22cc10)' }}
      >
        {working ? 'Loading…' : 'Get Unleashed — £2.99/mo'}
      </button>
    )
  }

  return (
    <SignInButton mode="modal">
      <button
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #39ff14, #22cc10)' }}
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
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-24">
        <div ref={heroLogoRef} className="mb-8">
          <DrawzillaLogo iconSize={80} fontSize="4.5rem" letterGap={2} />
        </div>

        <div
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-6 border"
          style={{ borderColor: 'rgba(57,255,20,0.3)', color: '#a8ff87', background: 'rgba(57,255,20,0.08)' }}
        >
          <span style={{ color: '#39ff14' }}>✦</span>
          drawzilla Unleashed
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight max-w-xl">
          Your canvas,{' '}
          <span style={{ color: '#39ff14' }}>unleashed</span>
        </h1>

        <p className="text-white/50 text-base max-w-sm mb-10 leading-relaxed">
          Everything in drawzilla, plus unlimited canvases, clean exports, share links, and more.
        </p>

        <CtaButton hideIfPro />

        {planKnown && !isUnleashed && <p className="mt-4 text-xs text-white/25">Cancel anytime. No lock-in.</p>}
      </section>

      {/* Profile section — pro users only */}
      {planKnown && isSignedIn && isUnleashed && (
        <ProfileSection startedAt={status?.startedAt ?? null} />
      )}

      {/* Features */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-4 border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div className="text-sm font-medium text-white/80 mb-1">{f.title}</div>
              <div className="text-xs text-white/40 leading-relaxed">{f.description}</div>
            </div>
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
            <p className="text-xs text-white/30 mb-6">Billed monthly. Cancel anytime.</p>

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
