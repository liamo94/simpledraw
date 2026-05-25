# Plan: Unleashed

A Pro subscription tier for drawzil.la at £2.99/mo.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User's Browser                       │
│                                                             │
│   drawzil.la                unleash.drawzil.la              │
│   (apps/drawtool)           (apps/unleashed)                │
│   React + Vite              React + Vite                    │
│        │                         │                          │
│        └──── Clerk.js (auth) ────┘                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
          ┌──────────────▼──────────────┐
          │     Cloudflare Pages        │
          │  (static hosting, free)     │
          └──────────────┬──────────────┘
                         │
          ┌──────────────▼──────────────┐
          │    drawzilla-backend        │
          │    Cloudflare Workers       │◄──── Clerk webhooks
          │    (REST API)               │◄──── Stripe webhooks
          └────┬──────────┬─────────────┘
               │          │
     ┌─────────▼──┐  ┌────▼────────┐
     │ D1 (SQLite)│  │  R2 (Blobs) │
     │            │  │             │
     │ users      │  │ canvases/   │
     │ workspaces │  │ {id}.json   │
     │ canvases   │  └─────────────┘
     │ subs       │
     └────────────┘

External services:
  Clerk  — auth, session management, user identity
  Stripe — subscription billing, checkout, customer portal
```

---

## Tiers

| | Free (local) | Free (signed in) | Pro £2.99/mo |
|---|---|---|---|
| Workspaces | 1 local (9 slots) | 1 cloud (9 slots) | Unlimited cloud |
| Storage | localStorage | R2 | R2 |
| PNG / SVG export | With watermark | With watermark | Clean |
| View & fork share links | Yes | Yes | Yes |
| Create share links | No | No | Yes |
| Themes | Standard | Standard | Standard + Pro-only |
| Priority support | No | No | Yes |

---

## New repos / apps

| | Location | URL |
|---|---|---|
| Landing page | `apps/unleashed/` (this monorepo) | `unleash.drawzil.la` |
| Backend API | Separate repo: `drawzilla-backend` | Cloudflare Workers |

---

## Backend (`drawzilla-backend`)

**Stack:** Cloudflare Workers · D1 (SQLite) · R2 · Stripe webhooks · Clerk auth

### D1 schema

```
users
  clerk_id          TEXT PRIMARY KEY
  email             TEXT
  stripe_customer_id TEXT
  plan              TEXT    -- "free" | "pro"
  created_at        INTEGER

workspaces
  id                TEXT PRIMARY KEY
  user_id           TEXT    -- FK users.clerk_id
  name              TEXT    -- default "Workspace N"
  position          INTEGER -- display order
  created_at        INTEGER

canvases
  id                TEXT PRIMARY KEY
  workspace_id      TEXT    -- FK workspaces.id
  name              TEXT    -- default "Canvas N"
  r2_key            TEXT    -- canvases/{id}.json
  share_token       TEXT    -- null if not shared
  share_enabled     INTEGER -- 0 | 1
  position          INTEGER
  updated_at        INTEGER
  created_at        INTEGER

subscriptions
  id                TEXT PRIMARY KEY
  user_id           TEXT
  stripe_sub_id     TEXT
  status            TEXT    -- "active" | "cancelling" | "expired"
  current_period_end INTEGER
  cancel_at         INTEGER -- set on cancellation: now + 30 days
```

### R2

Canvas blobs stored as JSON at `canvases/{canvas_id}.json`

### API routes

```
# Workspaces
POST   /workspaces                  create workspace (Pro only beyond first)
GET    /workspaces                  list user's workspaces
PATCH  /workspaces/:id              rename workspace
DELETE /workspaces/:id

# Canvases
POST   /canvases                    create canvas in a workspace
GET    /canvases/:id                load canvas
PUT    /canvases/:id                save canvas (debounced auto-save)
PATCH  /canvases/:id                rename canvas
DELETE /canvases/:id

# Sharing (Pro only to create)
POST   /canvases/:id/share          generate share token
DELETE /canvases/:id/share          disable share link
GET    /share/:token                public read-only — no auth required

# Migration
POST   /migrate                     move localStorage canvases to cloud on first sign-in

# Stripe
POST   /stripe/webhook              handle subscription lifecycle events

# Clerk
POST   /clerk/webhook               user.created → provision free account in D1
```

---

## drawtool app changes (`apps/drawtool/`)

1. **Clerk provider** — wrap app, sign in / sign up button in Menu
2. **Migration prompt** — on first sign-in, if localStorage has canvases: modal asking to move them to cloud workspace
3. **Workspace + canvas switcher** — replaces the 1–9 slot UI for signed-in users; local slot UI remains for signed-out free users
4. **Auto-save** — debounced save to backend on canvas change (signed-in users)
5. **Share button** — Pro only; generates `drawzil.la/s/{token}`; read-only public viewer built into the app
6. **Fork** — any user visiting a share link can pull it into their workspace / local slots
7. **Export watermark** — on PNG and SVG export, if not Pro, stamp "Made with drawzil.la" in bottom-right corner before download
8. **Pro themes** — 2–3 themes gated behind subscription check

---

## Landing page (`apps/unleashed/`)

Simple marketing page at `unleash.drawzil.la`. Same stack: React 19 + Vite + Tailwind v4.

- Hero + feature highlights
- Pricing card (£2.99/mo)
- CTA → Stripe Checkout
- Stripe Customer Portal link for existing subscribers to manage / cancel
- `/privacy` — Privacy Policy (generated via Iubenda or Termly)
- `/terms` — Terms of Service (generated via Iubenda or Termly)
- No cookie banner needed if analytics-free; use Plausible (cookie-free) if analytics are added

---

## Stripe integration

- **Checkout** — subscription creation, redirect back to drawzil.la on success
- **Customer Portal** — self-serve cancel and payment update
- **Webhooks** handled in Worker:
  - `customer.subscription.updated` → update plan + status in D1
  - `customer.subscription.deleted` → set status to `cancelling`, set `cancel_at = now + 30 days`

---

## Cancellation flow

1. User cancels via Stripe Customer Portal
2. Webhook fires → D1: `status = cancelling`, `cancel_at = now + 30 days`
3. Full Pro access continues during grace period
4. Banner shown in app: *"Your subscription ends on {date}. Resubscribe or export your data."*
5. Cloudflare **Cron Trigger** runs daily:
   - Finds subscriptions where `cancel_at < now` and `status = cancelling`
   - Deletes all R2 blobs for that user's canvases
   - Deletes canvas, workspace, subscription rows from D1
   - Sets user `plan = free`
6. Resubscribing before `cancel_at` restores immediately — no data lost

---

## Share links

- Links are permanent — stay live as long as the canvas exists in R2
- No expiry on cancellation (canvas is deleted after 30-day grace, which kills the link naturally)
- Free users can fork a shared canvas into their own workspace / local slots

---

## Privacy & encryption

- Canvas data is **encrypted at rest** by Cloudflare R2 (AES-256) — standard infrastructure-level encryption
- drawzil.la staff can technically access canvas data as operator of the service, but do not do so except as required to operate it
- This is the same model used by Notion, Figma, and Linear — it is the industry standard for creative/productivity tools
- True end-to-end (client-side) encryption is deferred to v2; it requires key management that is non-trivial with Clerk-based auth

**Privacy policy wording (suggested):**
> "Your canvases are encrypted at rest on Cloudflare's infrastructure. We do not access your data except as required to operate the service."

---

## Deferred to v2

- Workspace / canvas thumbnails
- Real-time collaboration
- Password-protected share links
- Version history

---

## Build order (suggested)

1. **Backend repo** — D1 schema, R2 setup, core CRUD routes, Clerk webhook
2. **Auth in drawtool** — Clerk provider, sign in/out, migration prompt
3. **Cloud save** — auto-save to backend, workspace/canvas switcher UI
4. **Stripe + landing page** — Checkout, webhook, plan gating in app
5. **Share links** — generate token, public viewer, fork flow
6. **Export watermark + Pro themes** — final polish
