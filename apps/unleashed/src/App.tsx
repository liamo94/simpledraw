import { useState, useEffect, useRef } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "https://api.drawzil.la";

type SubStatus = {
  plan: string;
  subscription: { status: string; cancelAt: number | null } | null;
  startedAt: number | null;
} | null;

type SharedCanvas = {
  token: string;
  type: string;
  view_count: number;
  canvas_id: string;
  canvas_name: string;
  workspace_id: string;
  workspace_name: string;
};
type SharedWorkspace = {
  id: string;
  name: string;
  token: string;
  view_count: number;
};
type SharedItems = { workspaces: SharedWorkspace[]; canvases: SharedCanvas[] };

// ─── Comparison data ──────────────────────────────────────────────────────────

type CellValue = boolean | string;

type ComparisonRow = {
  feature: string;
  free: CellValue;
  pro: CellValue;
  soon?: boolean;
};

type ComparisonSection = {
  title: string;
  rows: ComparisonRow[];
};

const COMPARISON: ComparisonSection[] = [
  {
    title: "Canvases",
    rows: [
      { feature: "Canvas slots", free: "3", pro: "9" },
      { feature: "Cloud sync", free: true, pro: true },
      { feature: "Settings sync across devices", free: true, pro: true },
    ],
  },
  {
    title: "Sharing",
    rows: [
      { feature: "Canvas share links", free: true, pro: "Live" },
      { feature: "Workspace share links", free: false, pro: true },
      { feature: "View counts", free: false, pro: true },
      { feature: "Expiring links", free: false, pro: true },
      { feature: "Password-protected links", free: false, pro: true },
      { feature: "Embed widget", free: false, pro: true },
      { feature: "Presentation mode", free: false, pro: true },
    ],
  },
  {
    title: "Export",
    rows: [
      { feature: "Export & import canvases", free: true, pro: true },
      { feature: "PNG export", free: "Marked", pro: "Clean" },
      { feature: "SVG export", free: false, pro: true },
      { feature: "PDF export", free: false, pro: true },
      { feature: "Export selection", free: false, pro: true },
    ],
  },
  {
    title: "Organization",
    rows: [{ feature: "Workspaces", free: "1", pro: true }],
  },
  {
    title: "Themes & colors",
    rows: [
      { feature: "Colors", free: "Palette", pro: "Any color" },
      { feature: "Themes", free: "8 built-in", pro: "Custom" },
      { feature: "Custom menu icon", free: false, pro: true },
    ],
  },
  {
    title: "Tools",
    rows: [
      { feature: "Infinite canvas", free: true, pro: true },
      { feature: "Drawing tools", free: "11", pro: "11" },
      { feature: "Shapes", free: "10", pro: "10" },
      { feature: "Font families", free: "6", pro: "6" },
      { feature: "All keyboard shortcuts", free: true, pro: true },
      { feature: "Pressure sensitivity", free: true, pro: true },
      { feature: "Insert images", free: true, pro: true },
      { feature: "Stash", free: true, pro: true },
      { feature: "Rebindable mouse buttons", free: true, pro: true },
    ],
  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8l3.5 3.5L13 4"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5 5l6 6M11 5l-6 6"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Cell({ value, isPro }: { value: CellValue; isPro: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <CheckIcon color={isPro ? "#39ff14" : "rgba(255,255,255,0.4)"} />
    ) : (
      <CrossIcon />
    );
  }
  return (
    <span
      className="text-sm font-medium"
      style={{ color: isPro ? "#a8ff87" : "rgba(255,255,255,0.45)" }}
    >
      {value}
    </span>
  );
}

function ComparisonTable() {
  return (
    <section className="max-w-2xl mx-auto px-4 pb-24">
      <p className="text-center text-[11px] text-white/25 uppercase tracking-widest mb-4">
        Compare plans
      </p>
      <p className="text-center text-white/50 text-sm mb-8 leading-relaxed">
        drawzilla is free forever. Unleashed is your upgrade when you're ready
        to take it to the next level.
      </p>

      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Column headers */}
        <div
          className="grid border-b"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) 72px 104px",
            borderColor: "rgba(255,255,255,0.07)",
          }}
        >
          <div className="px-5 py-4" />
          <div
            className="flex items-center justify-center px-2 py-4 border-l"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <span className="text-xs font-semibold text-white/30">
              drawzilla
            </span>
          </div>
          <div
            className="flex items-center justify-center px-2 py-4 border-l"
            style={{
              borderColor: "rgba(57,255,20,0.15)",
              background: "rgba(57,255,20,0.05)",
            }}
          >
            <span
              style={{
                fontFamily: "'Bangers', cursive",
                fontSize: "0.9rem",
                letterSpacing: "0.1em",
                color: "#39ff14",
              }}
            >
              UNLEASHED
            </span>
          </div>
        </div>

        {COMPARISON.map((section, si) => (
          <div key={section.title}>
            {/* Section header */}
            <div
              className="grid border-b"
              style={{
                gridTemplateColumns: "minmax(0, 1fr) 72px 104px",
                borderColor: "rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="col-span-3 px-5 py-2"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                  {section.title}
                </span>
              </div>
            </div>

            {section.rows.map((row, ri) => {
              const isLast =
                ri === section.rows.length - 1 && si === COMPARISON.length - 1;
              return (
                <div
                  key={row.feature}
                  className="grid"
                  style={{
                    gridTemplateColumns: "minmax(0, 1fr) 72px 104px",
                    borderBottom: isLast
                      ? "none"
                      : "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="flex items-center gap-2 px-5 py-3">
                    <span className="text-sm text-white/60">{row.feature}</span>
                    {row.soon && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                        style={{
                          background: "rgba(255,200,50,0.1)",
                          color: "rgba(255,200,50,0.6)",
                          border: "1px solid rgba(255,200,50,0.15)",
                        }}
                      >
                        soon
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center justify-center border-l"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <Cell value={row.free} isPro={false} />
                  </div>
                  <div
                    className="flex items-center justify-center border-l"
                    style={{
                      borderColor: "rgba(57,255,20,0.1)",
                      background: "rgba(57,255,20,0.025)",
                    }}
                  >
                    <Cell value={row.pro} isPro={true} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function formatSince(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function useSubStatus() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  const { data: status, isLoading } = useQuery<SubStatus>({
    queryKey: ["subStatus"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      const res = await fetch(`${API_URL}/stripe/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 60_000,
  });

  return { status: status ?? null, loading: !isLoaded || isLoading };
}

function useSharedItems() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<SharedItems>({
    queryKey: ["sharedItems"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { workspaces: [], canvases: [] };
      const res = await fetch(`${API_URL}/workspaces/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["sharedItems"] });

  return { items: items ?? null, loading: isLoading, refetch };
}

// ─── Shared UI components ─────────────────────────────────────────────────────

import { DrawzillaLogo, LOGO_LETTERS, DRAW_URL } from "./Logo";
import { FeatureSection } from "./components/FeatureShowcase";

function Nav({ scrolled }: { scrolled: boolean }) {
  const { isSignedIn } = useUser();
  return (
    <nav
      className={`fixed top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-4 transition-transform duration-300 ${scrolled ? "translate-y-0" : "-translate-y-full"}`}
      style={{
        background: "rgba(6,6,15,0.85)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <DrawzillaLogo iconSize={32} fontSize="1.5rem" />
      <div className="flex items-center gap-3">
        <a
          href={DRAW_URL}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
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
  );
}

function CtaButton({ hideIfPro = false }: { hideIfPro?: boolean }) {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { status, loading } = useSubStatus();
  const [working, setWorking] = useState(false);

  async function handleCheckout() {
    setWorking(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          successUrl: `${DRAW_URL}?unleashed=1`,
          cancelUrl: window.location.href,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("No redirect URL");
      window.location.href = data.url;
    } catch {
      alert(
        "Couldn't start checkout - please try again or contact support@drawzil.la",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handlePortal() {
    setWorking(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/stripe/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("No redirect URL");
      window.location.href = data.url;
    } catch {
      alert(
        "Couldn't open billing portal - please try again or contact support@drawzil.la",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div style={{ height: "44px" }} />;

  const isUnleashed = status?.plan === "pro";

  if (isSignedIn && isUnleashed) {
    if (hideIfPro) return <div style={{ height: "44px" }} />;
    return (
      <button
        onClick={handlePortal}
        disabled={working}
        className="text-xs px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 hover:text-white/80 transition-colors disabled:opacity-50"
      >
        {working ? "Loading…" : "Manage subscription"}
      </button>
    );
  }

  if (isSignedIn) {
    return (
      <button
        onClick={handleCheckout}
        disabled={working}
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #39ff14, #22cc10)",
          color: "#0a1a04",
        }}
      >
        {working ? "Loading…" : "Get Unleashed - £2.99/mo"}
      </button>
    );
  }

  return (
    <SignInButton mode="modal">
      <button
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #39ff14, #22cc10)",
          color: "#0a1a04",
        }}
      >
        Get Unleashed - £2.99/mo
      </button>
    </SignInButton>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-white/25 hover:text-white/70 hover:bg-white/8 cursor-pointer"
      title="Copy link"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="#39ff14"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <path d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1H2.5A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4" />
        </svg>
      )}
    </button>
  );
}

function TypeBadge({ type }: { type: "live" | "snap" | "ws" }) {
  const styles: Record<string, string> = {
    live: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    snap: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ws: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const label = { live: "live", snap: "snap", ws: "workspace" }[type];
  return (
    <span
      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[type]}`}
    >
      {label}
    </span>
  );
}

function ViewCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="shrink-0 flex items-center gap-1 text-[11px] text-white/25">
      <svg
        width="11"
        height="11"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
        <circle cx="10" cy="10" r="3" />
      </svg>
      {count}
    </span>
  );
}

function ProfileSection({ startedAt }: { startedAt: number | null }) {
  const { getToken } = useAuth();
  const { items, loading, refetch } = useSharedItems();
  const [revoking, setRevoking] = useState<Set<string>>(new Set());

  async function revokeCanvas(canvasId: string, token: string) {
    const key = `canvas-${token}`;
    setRevoking((s) => new Set(s).add(key));
    try {
      const authToken = await getToken();
      await fetch(`${API_URL}/canvases/${canvasId}/share/${token}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      refetch();
    } finally {
      setRevoking((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  }

  async function revokeWorkspace(workspaceId: string) {
    const key = `ws-${workspaceId}`;
    setRevoking((s) => new Set(s).add(key));
    try {
      const authToken = await getToken();
      await fetch(`${API_URL}/workspaces/${workspaceId}/share`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      refetch();
    } finally {
      setRevoking((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  }

  const totalShared =
    (items?.workspaces.length ?? 0) + (items?.canvases.length ?? 0);

  return (
    <section className="max-w-2xl mx-auto px-6 pb-16">
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: "rgba(15,15,30,0.97)",
          borderColor: "rgba(57,255,20,0.12)",
          boxShadow:
            "0 0 60px rgba(57,255,20,0.05), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.07)",
            background: "rgba(57,255,20,0.04)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(57,255,20,0.12)",
                boxShadow: "0 0 12px rgba(57,255,20,0.2)",
              }}
            >
              <span style={{ color: "#39ff14", fontSize: 14 }}>✦</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">
                {startedAt
                  ? `Unleashed since ${formatSince(startedAt)}`
                  : "Unleashed"}
              </div>
              <div className="text-[11px] text-white/30 mt-0.5">
                Pro plan · active
              </div>
            </div>
          </div>
          <CtaButton hideIfPro={false} />
        </div>

        <div className="px-5 py-4">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
            Shared publicly
          </div>

          {loading ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : totalShared === 0 ? (
            <div className="py-6 text-center">
              <div className="text-white/20 text-sm">No public shares yet.</div>
              <div className="text-white/12 text-xs mt-1">
                Share a canvas from the drawzilla app to see it here.
              </div>
            </div>
          ) : (
            <div
              className="scrollbar-thin space-y-1 overflow-y-auto"
              style={{ maxHeight: "21rem" }}
            >
              {items?.workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)")
                  }
                >
                  <TypeBadge type="ws" />
                  <span className="text-sm text-white/75 truncate flex-1">
                    {ws.name}
                  </span>
                  <ViewCount count={ws.view_count} />
                  <CopyButton url={`${DRAW_URL}/s/w/${ws.token}`} />
                  <button
                    onClick={() => revokeWorkspace(ws.id)}
                    disabled={revoking.has(`ws-${ws.id}`)}
                    className="shrink-0 text-[11px] text-white/25 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    {revoking.has(`ws-${ws.id}`) ? "Stopping…" : "Unshare"}
                  </button>
                </div>
              ))}

              {items?.canvases.map((c) => (
                <div
                  key={c.token}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)")
                  }
                >
                  <TypeBadge type={c.type === "live" ? "live" : "snap"} />
                  <span className="text-sm text-white/75 truncate flex-1">
                    {c.canvas_name}
                  </span>
                  <span className="text-[11px] text-white/25 shrink-0 hidden sm:block">
                    {c.workspace_name}
                  </span>
                  <ViewCount count={c.view_count} />
                  <CopyButton url={`${DRAW_URL}/s/${c.token}`} />
                  <button
                    onClick={() => revokeCanvas(c.canvas_id, c.token)}
                    disabled={revoking.has(`canvas-${c.token}`)}
                    className="shrink-0 text-[11px] text-white/25 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    {revoking.has(`canvas-${c.token}`)
                      ? "Stopping…"
                      : "Unshare"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Feature bento grid ───────────────────────────────────────────────────────

function BentoMediaTile({
  label,
  imgSrc,
  videoSrc,
  stat,
  className,
  style,
}: {
  label: string;
  imgSrc?: string;
  videoSrc?: string;
  stat?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className ?? ""}`}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      {imgSrc && (
        <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {videoSrc && (
        <video src={videoSrc} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}
      {stat && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span style={{ fontFamily: "'Bangers', cursive", fontSize: "5.5rem", letterSpacing: "0.04em", color: "#39ff14", lineHeight: 1, textShadow: "0 0 40px rgba(57,255,20,0.6), 0 0 80px rgba(57,255,20,0.2)" }}>
            {stat}
          </span>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)" }}>
            canvas slots
          </span>
        </div>
      )}
      {!stat && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ padding: "50px 18px 18px", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)" }}
        >
          <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { isSignedIn, isLoaded } = useUser();
  const { status, loading: statusLoading } = useSubStatus();
  const isUnleashed = status?.plan === "pro";
  const planKnown = isLoaded && !statusLoading;
  const heroLogoRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = heroLogoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-white" style={{ background: "#06060f" }}>
      <Nav scrolled={scrolled} />

      {/* Hero — hybrid wall */}
      <section ref={heroLogoRef} className="flex flex-col lg:h-screen pt-16 overflow-hidden">

        {/* Desktop wall */}
        <div
          className="flex-1 hidden lg:grid"
          style={{
            gap: "3px",
            background: "#06060f", /* gap colour = page bg so brand cells vanish */
            gridTemplateColumns: "0.8fr 1.7fr 1.1fr",
            gridTemplateRows: "2fr 1.3fr 0.9fr",
          }}
        >
          {/* ── Col 1 row 1: Mascot — no box, floats on page bg ── */}
          <div className="relative overflow-hidden" style={{ background: "#06060f", gridColumn: "1", gridRow: "1" }}>
            <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
              <defs>
                <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 3 0" />
                </filter>
              </defs>
            </svg>
            <div style={{ position: "absolute", top: 20, left: 20, zIndex: 1 }}>
              <DrawzillaLogo iconSize={30} fontSize="1.6rem" letterGap={1} />
            </div>
            <img
              src="/mascot.png"
              alt="drawzilla mascot"
              style={{ position: "absolute", bottom: "-6%", left: "50%", transform: "translateX(-50%)", height: "82%", objectFit: "contain", filter: "url(#remove-white-bg)" }}
            />
          </div>

          {/* ── Cols 2–3 row 1: Workspaces — wide media panel ── */}
          <BentoMediaTile label="Workspaces" imgSrc="/workspaces.png"
            style={{ gridColumn: "2 / 4", gridRow: "1", borderRadius: 0 }} />

          {/* ── Col 1 row 2: UNLEASHED — no box, floats ── */}
          <div
            className="flex flex-col justify-center gap-3 p-6"
            style={{ background: "#06060f", gridColumn: "1", gridRow: "2" }}
          >
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", fontWeight: 500, letterSpacing: "0.01em" }}>Your canvas,</p>
            <p style={{ fontFamily: "'Bangers', cursive", fontSize: "clamp(1.8rem, 3vw, 3rem)", letterSpacing: "0.06em", color: "#39ff14", lineHeight: 1, textShadow: "0 0 30px rgba(57,255,20,0.45)" }}>
              UNLEASHED.
            </p>
            <div className="mt-1">
              <CtaButton hideIfPro />
              <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.18)", visibility: planKnown && !isUnleashed ? "visible" : "hidden" }}>
                Cancel anytime.
              </p>
            </div>
          </div>

          {/* ── Col 2 row 2: Presentation ── */}
          <BentoMediaTile label="Presentation mode" videoSrc="/presentation.mp4"
            style={{ gridColumn: "2", gridRow: "2", borderRadius: 0 }} />

          {/* ── Col 3 row 2: Share ── */}
          <BentoMediaTile label="Share links" videoSrc="/share.mp4"
            style={{ gridColumn: "3", gridRow: "2", borderRadius: 0 }} />

          {/* ── Col 1 row 3: Themes ── */}
          <BentoMediaTile label="Themes & colors" videoSrc="/theme-and-color.mp4"
            style={{ gridColumn: "1", gridRow: "3", borderRadius: 0 }} />

          {/* ── Col 2 row 3: Export ── */}
          <BentoMediaTile label="Clean exports" videoSrc="/export.mp4"
            style={{ gridColumn: "2", gridRow: "3", borderRadius: 0 }} />

          {/* ── Col 3 row 3: 9 canvases ── */}
          <BentoMediaTile label="Canvas slots" stat="9"
            style={{ gridColumn: "3", gridRow: "3", borderRadius: 0 }} />
        </div>

        {/* Mobile: simple stack */}
        <div className="lg:hidden flex flex-col gap-3 px-4 pb-10">
          <div className="pt-4 flex flex-col gap-4">
            <DrawzillaLogo iconSize={32} fontSize="1.75rem" letterGap={1} />
            <h1 className="text-4xl font-bold tracking-tight leading-[1.1]">
              Your canvas,{" "}
              <span style={{ fontFamily: "'Bangers', cursive", letterSpacing: "0.08em", color: "#39ff14", display: "block", textShadow: "0 0 20px rgba(57,255,20,0.4)" }}>UNLEASHED.</span>
            </h1>
            <CtaButton hideIfPro />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <BentoMediaTile label="Workspaces" imgSrc="/workspaces.png" className="col-span-2 aspect-video" />
            <BentoMediaTile label="Presentation mode" videoSrc="/presentation.mp4" className="aspect-video" />
            <BentoMediaTile label="Share links" videoSrc="/share.mp4" className="aspect-video" />
            <BentoMediaTile label="Themes & colors" videoSrc="/theme-and-color.mp4" className="aspect-video" />
            <BentoMediaTile label="Clean exports" videoSrc="/export.mp4" className="aspect-video" />
          </div>
        </div>
      </section>

      {/* Feature showcase */}
      <FeatureSection
        imgSrc="/workspaces.png"
        videoLabel="Multiple workspaces open, switching between projects"
        headline="One place for every project"
        tag="Workspaces"
        body={
          <>
            Create separate workspaces to keep client work, personal projects,
            and ideas from bleeding into each other. Each workspace gets its own
            canvases and share settings.
          </>
        }
      />

      <FeatureSection
        flip
        videoSrc="/presentation.mp4"
        videoLabel="Video: entering presentation mode, stepping through a canvas"
        headline="Present without leaving the canvas"
        tag="Presentation mode"
        body={
          <>
            Turn any canvas into a presentation. Walk your audience through your
            ideas step by step. No extra tools, no exports, no switching apps.
          </>
        }
      />

      <FeatureSection
        videoLabel="Video: picking a custom canvas color and switching between themes"
        videoSrc="/theme-and-color.mp4"
        headline="Make it yours"
        tag="Themes & colors"
        body={
          <>
            Pick from 8 built-in themes, or go fully custom: any color for your
            background, any color for your strokes. Every canvas, exactly how
            you like it.
          </>
        }
      />

      <FeatureSection
        flip
        videoSrc="/share.mp4"
        videoLabel="Video: generating a share link, opening the live share viewer"
        headline="Share your work, live"
        tag="Share links"
        body={
          <>
            Publish a canvas or an entire workspace as a live link, always
            showing your latest changes. Track view counts, revoke links any
            time, or password-protect them for private sharing.
          </>
        }
      />

      <FeatureSection
        videoSrc="/export.mp4"
        videoLabel="Video: exporting a canvas as SVG and clean PNG"
        headline="Export without the watermark"
        tag="Clean exports"
        body={
          <>
            Download your work as a crisp, watermark-free PNG, a scalable SVG,
            or a PDF ready to print or share. Export your full canvas or just a
            selection.
          </>
        }
      />

      {/* Profile section - pro users only */}
      {planKnown && isSignedIn && isUnleashed && (
        <ProfileSection startedAt={status?.startedAt ?? null} />
      )}

      {/* Comparison table */}
      <ComparisonTable />

      {/* Pricing - hidden for existing subscribers */}
      {planKnown && !isUnleashed && (
        <section className="flex justify-center px-6 pb-32">
          <div
            className="w-full max-w-xs rounded-2xl p-6 border text-center"
            style={{
              background: "rgba(57,255,20,0.06)",
              borderColor: "rgba(57,255,20,0.2)",
            }}
          >
            <div className="text-xs text-white/40 uppercase tracking-widest mb-3">
              Unleashed
            </div>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-4xl font-bold">£2.99</span>
              <span className="text-white/40 text-sm mb-1.5">/mo</span>
            </div>
            <p className="text-xs text-white/30 mb-6">
              Billed monthly. Cancel anytime via your account portal. No refunds
              for partial months.
            </p>
            <CtaButton />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/6 px-6 py-6 flex items-center justify-between text-xs text-white/25">
        <a href={DRAW_URL} className="flex items-center gap-1.5 no-underline">
          <img
            src="/drawzilla-simplifed.svg"
            alt=""
            style={{
              width: 18,
              height: 18,
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "Caveat Brush, cursive",
              fontSize: "1rem",
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {LOGO_LETTERS.map((l, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginLeft: i === 0 ? 0 : 1,
                  transform: `rotate(${l.rotate}deg)`,
                  color: l.color,
                }}
              >
                {l.letter}
              </span>
            ))}
          </span>
        </a>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-white/50 transition-colors">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white/50 transition-colors">
            Terms
          </a>
          <a
            href="mailto:support@drawzil.la"
            className="hover:text-white/50 transition-colors"
          >
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}
