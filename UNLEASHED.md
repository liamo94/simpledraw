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
| Workspaces | 1 local (9 slots) | 1 cloud (3 slots) | Unlimited cloud |
| Storage | localStorage | R2 | R2 |
| PNG / SVG export | With watermark | With watermark | Clean |
| View & fork share links | Yes | Yes | Yes |
| Create share links | No | Frozen (7-day) | Live (permanent) |
| Themes | Standard | Standard | Standard |
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
  share_token       TEXT
  share_enabled     INTEGER -- 0 | 1
  created_at        INTEGER

canvases
  id                TEXT PRIMARY KEY
  workspace_id      TEXT    -- FK workspaces.id
  name              TEXT    -- default "Canvas N"
  r2_key            TEXT    -- canvases/{id}.json
  position          INTEGER
  updated_at        INTEGER
  is_empty          INTEGER -- 1 = never saved, 0 = has content; set to 0 on first PUT; used for blank-canvas routing
  share_token       TEXT    -- legacy; live shares now in shares table
  share_enabled     INTEGER -- 1 if any live share exists
  created_at        INTEGER

shares
  token             TEXT PRIMARY KEY
  canvas_id         TEXT    -- FK canvases.id ON DELETE CASCADE
  type              TEXT    -- "frozen" | "live"
  r2_key            TEXT    -- set for frozen shares: shares/{token}.json
  expires_at        INTEGER -- null for live (permanent); unix timestamp for frozen
  created_at        INTEGER

subscriptions
  id                TEXT PRIMARY KEY
  user_id           TEXT
  stripe_sub_id     TEXT
  status            TEXT    -- "active" | "cancelling" | "expired"
  current_period_end INTEGER
  cancel_at         INTEGER -- set on cancellation: now + 30 days
  started_at        INTEGER -- Stripe subscription start_date; set on creation
```

### R2

Canvas blobs stored as JSON at `canvases/{canvas_id}.json`

### API routes

```
# Workspaces
POST   /workspaces                  create workspace (Pro only beyond first)
GET    /workspaces                  list user's workspaces + canvases (includes share_enabled/share_token)
GET    /workspaces/shared           list all active shares (workspaces + canvases) for the authed user
GET    /workspaces/export           export all workspace + canvas data for zip download
PATCH  /workspaces/:id              rename workspace
DELETE /workspaces/:id
POST   /workspaces/:id/share        enable workspace share link (Pro only)
DELETE /workspaces/:id/share        revoke workspace share link

# Canvases
POST   /canvases                    create canvas in a workspace
GET    /canvases/:id                load canvas
PUT    /canvases/:id                save canvas (debounced auto-save)
PATCH  /canvases/:id                rename canvas
DELETE /canvases/:id
POST   /canvases/reorder            reorder canvases within a workspace

# Sharing
GET    /canvases/:id/shares         list active shares for a canvas (auth required)
POST   /canvases/:id/share          create share: Pro → live permanent; Free → frozen snapshot (7-day, 100-cap)
DELETE /canvases/:id/share/:token   revoke specific share token; cleans up R2 blob if frozen
GET    /share/:token                public read-only — no auth required; frozen serves snapshot, live reads current canvas
DELETE /share/:token                auth'd revocation (same as above, via share token directly)

# Migration
POST   /migrate                     move localStorage canvases to cloud on first sign-in

# Stripe
GET    /stripe/status               return plan, subscription status, startedAt
POST   /stripe/checkout             create Stripe checkout session
POST   /stripe/portal               open Stripe customer portal (manage/cancel)
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

Two types of share link:

- **Frozen** (free signed-in users) — snapshot of the canvas at time of creation, stored as `shares/{token}.json` in R2. 7-day expiry. Up to 100 active frozen links per canvas (hard cap never reached in normal use). Cron cleans up expired blobs daily.
- **Live** (Pro) — reads the canvas's live R2 blob at view time. Permanent until the canvas is deleted or the link is revoked.

Workspace shares are Pro-only and always live. On cancellation, canvases are deleted after the 30-day grace period, which removes all associated share links naturally.

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

- Real-time collaboration
- Password-protected share links
- Version history

---

## Build order (suggested)

1. **Backend repo** — D1 schema, R2 setup, core CRUD routes, Clerk webhook ✅
2. **Auth in drawtool** — Clerk provider, sign in/out, migration prompt ✅
3. **Cloud save** — auto-save to backend, workspace/canvas switcher UI ✅
4. **Stripe + landing page** — Checkout, webhook, plan gating in app ✅
5. **Share links** — generate token, public viewer, fork flow ✅
6. **Export watermark** ✅

---

## Current status

### Done
- **Backend** (`drawzilla-backend/`)
  - Hono Workers app: `/workspaces`, `/canvases`, `/share`, `/migrate`, `/stripe`, `/clerk`, `/stash`, `/preferences`
  - D1 migrations 0001–0005 (initial schema, nullable email, workspace share, preferences column, shares table)
  - R2 canvas blob storage — `CanvasData` includes optional `images: Record<string, string>` (base64) for embedded images
  - Canvas PUT: 20 MB hard limit (content-length + actual body length checked); preferences PUT: 64 KB limit
  - Canvas hard cap: 9 per workspace for all users (enforced server-side); reorder endpoint validates against cap
  - Cron: daily cleanup of expired subscriptions + expired frozen share blobs — batched; restores blank free workspace after data deletion
  - Daily D1 backup: all tables dumped to `backups/YYYY-MM-DD.json` in R2; 7-day retention; cron now runs cleanups first, then backup (prevents inconsistent snapshots)
  - Cleanup logic extracted to `src/utils/cleanup.ts` — shared between cron and dev test endpoints
  - Frozen share R2 blob leak fixed everywhere: `DELETE /canvases/:id` and `DELETE /workspaces/:id` now also delete `shares/{token}.json` R2 blobs for frozen shares; `cleanupUserData` covers subscription expiry path
  - `GET /workspaces/export` — returns all workspace + canvas data (strokes, view, images) for zip download; capped at 50 canvases total via SQL LIMIT
  - Dev test endpoints (only active when `ENVIRONMENT === 'development'`): `POST /stripe/dev/cancel`, `/dev/expire`, `/dev/reset` — simulate cancellation states without Stripe; enable by setting `ENVIRONMENT=development` in `.dev.vars`
  - Performance: canvas save stores raw request body (skips parse+re-serialize); canvas create batches 3 D1 queries into 1 round trip; `generateShareToken` extracted to `utils/token.ts`; `requireAuth` middleware does conditional INSERT (SELECT first, only inserts on miss)
  - Security: canvas GET strips `r2_key`/`workspace_id` from response; share endpoints validate token format before DB lookup; migrate validates canvas structure + per-canvas size; rename endpoints cap name at 200 chars; `POST /stripe/checkout` and `POST /stripe/portal` validate redirect URLs against `drawzil.la` / `unleash.drawzil.la` allowlist
  - `POST /canvases/reorder` validates all submitted IDs belong to the same workspace (prevents cross-workspace position corruption)
  - `POST /migrate` clamps imported canvas count by remaining slots (`cloudLimit - existingCount`), not raw plan limit
  - `customer.subscription.updated` webhook now handles non-active statuses (`past_due`, `unpaid`, etc.) — immediately sets `plan = free` instead of waiting for `subscription.deleted` days later
  - R2 backup pruning loop handles paginated `list()` results (cursor-based iteration)

- **Auth & migration** (`apps/drawtool/`)
  - Clerk provider, sign in/out button in menu
  - Migration modal: move localStorage canvases to cloud on first sign-in; "Start fresh" provisions `canvasLimit` blank canvases (3 free / 9 Pro) and closes the modal
  - Migration key is per-user (`drawtool-migrated-{userId}`) — multi-user devices each get their own prompt
  - Migration gated on `workspacesLoaded`: returning user on a new device is silently marked done if cloud canvases already exist
  - Migration payload includes `savedDark` flag — prevents colour inversion when viewer's theme differs from the theme active at migration time
  - After migration, `fetchWorkspace()` is called so the workspace/canvas list updates without a page reload
  - Migration includes images: each canvas's stroke image IDs resolved from IDB and embedded as base64 in the payload
  - `useCloudCanvas` — loads workspaces/canvases from backend, auto-saves with 2 s debounce, `savedDark` flag for theme-aware colour swap on load
  - Canvas query: `staleTime: Infinity`, `refetchOnWindowFocus: false` — prevents mid-draw Canvas remount from background refetch
  - `DIRTY_KEY` (`drawtool-cloud-dirty`) localStorage flag: set when strokes change locally, cleared on server confirm; canvas query skips overwriting slot 1 if flag is set (fixes erase-then-refresh race condition)
  - `onBeforeUnload` always flushes (removed early-return guard) — fixes pan-only sessions not saving viewport position
  - `planLoading` gated on Clerk's `isLoaded` flag — eliminates Unleashed button flash during Clerk boot

- **Image cloud sync**
  - Images (paste/import) stored in IDB locally and also embedded as base64 in R2 canvas JSON
  - On cloud load: images from server response stored in IDB before Canvas mounts (async IIFE in query effect, before `loadKey` bump)
  - On save: `collectImages()` reads IDB and bundles base64 into PUT payload; `collectImagesSync()` (memory-cache only) used in `onBeforeUnload` (can't await)
  - Share viewer: images stored in IDB before Canvas mounts

- **Stripe billing** (`apps/unleashed/`)
  - Landing page at `unleash.drawzil.la` with hero, pricing card, FAQ
  - Checkout flow → success redirect to `drawzil.la`
  - Customer Portal for self-serve cancel / payment update — "Manage subscription" button on profile section
  - Webhooks: `customer.subscription.updated` / `.deleted` → D1 plan + status
  - `started_at` captured from Stripe `subscription.start_date` on webhook creation; stored in D1 subscriptions table (migration 0006)

- **Share links**
  - Canvas share (`/s/:token`) — all signed-in users (frozen 7-day for free, live permanent for Pro)
  - Workspace share (`/s/w/:token`) — Pro only (live permanent)
  - Multiple share links per canvas supported; each managed independently (create / copy / revoke)
  - `shares` table (migration 0005) decouples share metadata from `canvases`; frozen links stored at `shares/{token}.json` in R2
  - Cron cleanup for expired frozen shares runs daily alongside subscription cleanup
  - `ShareViewer.tsx`: tab bar for workspace shares, fork button (cloud or local slot), unshare (×), Copy feedback
  - Share viewer header: workspace name + logo / canvas tabs for workspace shares; logo / canvas name for canvas shares
  - Fork workspace: Pro-gated — non-Pro redirected to `unleash.drawzil.la`
  - Fork canvas: available to all; fills a free slot, warns if all 9 slots full (signed-out) or canvas limit hit (free signed-in); offers replace-slot and download alternatives; fork targets the user's active workspace (falls back to first workspace)
  - Auth status visible in share viewer: `UserButton` when signed in, "Sign in" button when signed out
  - Share viewer: Caveat Brush multicolor per-letter-rotated "drawzilla" branding + SVG logo in header
  - Share viewer: `g`/`G` cycles grid (forward/back), double-`d`/`D` (within 400 ms) cycles theme (forward/back)
  - Stroke colours re-adapted on theme change (black/white swap via `savedDark`; refs avoid stale closure)
  - Fork parallelized: all workspace canvases forked concurrently via `Promise.all`
  - Share viewer read-only: drawing and erasing fully blocked (`readOnly` prop forces `modifier = null`); cursor shows grab/hand in pan mode
  - Share list UI: rows show "Snapshot · Xh ago" label instead of truncated URL; coloured expiry badge (yellow/orange/red) keyed to urgency; `created_at` added to share POST responses to fix "NaNd ago"
  - Share viewer expiry warning: yellow/orange/red badge in viewer header for free users showing time remaining on frozen links; `expires_at` included in `GET /share/:token` response

- **Export**
  - PNG / transparent PNG: "drawzilla [icon]" watermark (Caveat Brush) for free users
  - SVG export: Pro-only (shown locked in menu for free users)
  - Export format, transparent bg, include-images preferences synced to cloud

- **Preferences sync**
  - `GET /preferences` / `PUT /preferences` on backend (stored as JSON in `users.preferences`)
  - `usePreferencesSync` hook: fetches on sign-in (backend wins over localStorage), debounced PUT on change (800 ms)
  - On sign-out: pending debounce is cancelled and a final PUT is attempted immediately (token may still be valid briefly)
  - On first sign-in with no cloud prefs: local settings are pushed up immediately so the next sign-in can restore them
  - Syncs full settings object: mouse buttons, fill/opacity, font, shape, grid, theme, export settings

- **Cancellation flow (app)**
  - `useUserPlan` now exposes `subscription: { status, cancelAt } | null` from `/stripe/status`
  - Cancellation panel moved into menu (amber block above sign-in row); shows end date, "Export data" + "Resubscribe" buttons
  - Resubscribe opens Stripe billing portal (`POST /stripe/portal`) so user can cancel the cancellation in-place — no re-entering payment info
  - Export data: `GET /workspaces/export` → all canvases fetched → zipped client-side with `fflate` as `WorkspaceName/CanvasName.json` → downloaded as `drawzilla-export.zip`

- **Upgrade prompt redesign**
  - Card shown when local (non-signed-in) user switches to canvas slot > their limit
  - Redesigned with green radial glow, full drawzilla logo, "Unlock 9 canvases" heading, green CTA button linking to `unleash.drawzil.la` with price
  - Canvas slot tooltip updated from "Coming soon with Unleashed" → "Unlock with Unleashed"
  - Upgrade modal now also shows for signed-in free users on slot > `canvasLimit` (removed `!cloudCanvas.activeId` guard)

- **Plan gating fixes**
  - `onSwitchCanvas`: `setActiveCanvas` no longer called unconditionally — blocked slots leave active slot unchanged
  - Workspace switcher (⌘O + top-left button) open to all signed-in users; "Add workspace" remains Pro-gated inside modal; search hidden for free users
  - Share canvas (`onShareCanvas`) gated on `activeCanvas <= canvasLimit`
  - Export panel greyed out (`dim` prop) for free users on canvas > limit; export button disabled
  - Share expiry display fixed: `Math.ceil` instead of `Math.floor` — fresh 7-day link now shows `7d` not `6d`
  - When plan drops from Pro → free, React Query invalidates workspaces + canvas queries so UI reflects backend state immediately

- **Sign-out** button in account row (bottom of menu)

- **Cross-device sync**
  - `lastActiveCanvasId` added to `Settings` — persisted via preferences sync so sign-in on any device reopens the last active canvas
  - Cross-device restore: `useCloudCanvas` accepts `preferredCanvasId`; effect watches both workspaces data and pref to switch once per session (guarded by `cloudPrefApplied` flag to prevent interfering with manual navigation)
  - Same-browser tab sync: `BroadcastChannel('drawtool-canvas-sync')` — after each cloud save, the saving tab broadcasts `{ canvasId }`; other tabs with the same canvas open refetch immediately
  - Cross-device / cross-tab polling: 30 s interval invalidates active canvas query when tab is visible and canvas is not dirty
  - Tab-focus sync: `visibilitychange` listener invalidates the canvas query when the tab becomes visible, flushing any updates deferred by the browser while the tab was in the background
  - Live sync preserves viewport: sync updates dispatch a `drawtool:sync-strokes` custom event instead of remounting the Canvas via `loadKey`; Canvas handles the event by replacing `strokesRef` in place and scheduling a redraw — `viewRef` is never touched, so pan/zoom position is unaffected
  - Initial canvas load (first fetch after switching canvases) still uses `bumpLoadKey` + `saveView` to restore the saved viewport
  - `DIRTY_KEY` check prevents syncing over unsaved local changes in all sync paths (broadcast, poll, visibility)

- **Architecture refactor**
  - `src/lib/api.ts` — `createApi(getToken)` typed API client factory; `get / post / put / patch / delete` one-liners replace all raw `fetch()` calls across `useCloudCanvas`, `usePreferencesSync`, `useUserPlan`, `ShareViewer`
  - `src/stores/cloudSessionStore.ts` — Zustand v5 store for cloud session state (`activeId`, `activeWorkspaceId`, `loadKey`, `clearKey`, cached names, `updated_at` map, session flags); custom `legacyStorage` adapter maps fields to the same individual localStorage keys that existed before (no migration, no breaking change for existing users)
  - `useCloudCanvas` refactored: 5 stale-closure `useRef` escapes removed (replaced by `useCloudSessionStore.getState()`); all 17 raw `fetch()` calls replaced by `api.*` one-liners; `beforeunload` keeps a raw `keepalive` fetch (can't await in that handler)

- **Workspaces UI**
  - `WorkspaceSwitcherModal`: search, keyboard nav, rename, create (Pro gated), clear canvas (trash icon → "Clear?" confirm), delete workspace
  - `clearCanvas`: PUTs empty blob to R2, clears slot 1 locally, bumps `clearKey` to force Canvas remount; non-active canvas clear evicts React Query cache so the next visit fetches fresh empty content
  - `deleteWorkspace`: deletes all R2 blobs + D1 rows for that workspace; switches to next workspace first if active
  - `CanvasReorderPanel` cloud mode: drag-and-drop reorder calls `/canvases/reorder`; opened via "Canvas manager" button in switcher footer or `drawtool:open-canvas-manager` event
  - `WorkspaceSwitcherModal` UX redesign: two-column master-detail layout; left panel has fixed `h-9` rows with workspace name + canvas count (no layout shift); right panel shows canvases for the hovered/focused workspace; edit + delete workspace buttons live in the right panel header (always visible, not on hover) — eliminates text-jump bugs from inline hover buttons; hover switches right panel with 150 ms debounce (`wsHoverTimer`), keyboard nav switches immediately; fixed modal height `h-[min(78vh,640px)]`; active workspace row styled with blue ring matching menu panel aesthetic; `viewingWsId` state decoupled from `focusedIdx` so left-panel highlight and right-panel content update independently
  - Canvas position renumbering: `deleteCanvasMutation.onSuccess` remaps remaining canvases to sequential positions (0, 1, 2…) — prevents position gaps after deletion that caused incorrect slot targeting

- **`/new` route and blank-canvas routing**
  - Module-level `_newRouteForCloud` flag detected before React renders; passed into `useCloudCanvas` as `newRoute` prop
  - `is_empty` column (migration 0007) on `canvases` — set to 1 on creation, 0 on first PUT; `GET /workspaces` includes it; removes all cache-inspection heuristics for blank detection
  - `newRoutePending` state gates Canvas render entirely until the destination canvas is chosen — no content leak from previous canvas before the switch
  - Slot 1 cleared before `newRoutePending` → false so Canvas never briefly shows stale strokes
  - All-occupied path: opens least-recently-updated canvas + sets `newRouteAllOccupied` to show blur overlay + dialog
  - `0` key dispatches `drawtool:find-blank-canvas`; cloud path in `findBlankCanvasRef` uses `is_empty` (same logic as `/new`); falls back to least-recently-updated if all occupied
  - `is_empty` patched to 0 in the `['workspaces']` React Query cache after every successful PUT (save timer and `flushCurrentCanvas`) — prevents `0` and `/new` re-selecting the same canvas after you've drawn on it
  - `0` key sets canvas name immediately (`setCanvasName`) so header is correct without waiting for the `activeCanvasMeta` effect
  - `CanvasReorderPanel` cloud mode: stroke counts read from `['canvas', id]` React Query cache and shown per row
  - Initial draw is immediate (no font-load wait): grid and strokes appear at once; font redraw fires after as a correction pass for text strokes

- **Canvas switching bug fixes** (`apps/drawtool/`)
  - Root cause: Canvas cleanup effect flushed pending `persistStrokesDebounced` timer to slot 1 (without `skipHook`), triggering the cloud save hook with the old canvas's strokes while `activeId` had already advanced to the new canvas — corrupting the new canvas's server data and eventually showing the wrong strokes via `drawtool:sync-strokes`
  - `hasSaveHook()` exported from `storage.ts`; Canvas cleanup now skips the localStorage flush in cloud mode (save hook registered), preventing slot 1 contamination and spurious server saves
  - `pendingSwitchRef` in `useCloudCanvas` — `switchCanvas` records the latest intended destination; aborts after the flush await if the user switched again in the meantime (fixes "stroke appears for a second then vanishes on canvas 1" when rapidly canvas1 → canvas2 → canvas1)
  - `flushCurrentCanvas` clears `DIRTY_KEY` on successful PUT so aborted switches don't leave a stale dirty flag; also patches `['canvas', id]` React Query cache with flushed strokes so `populateSlot1FromCache` is accurate if the user switches back before the server refetch
  - `flushCurrentCanvas` skips the PUT entirely if `DIRTY_KEY` is not set and no timer is pending — avoids a redundant network request when the 300ms timer already fired before the switch
  - `populateSlot1FromCache` pre-populates slot 1 with cached data before `setActiveCanvas` changes the Canvas key, so Canvas 2 mounts with correct strokes immediately
  - Save hook captures `forId` at schedule time; timer guard `id !== forId` prevents stale timers from writing the wrong canvas's strokes to the server
  - `leavingCanvas` clears `DIRTY_KEY` and marks the query stale (`refetchType: 'none'`) on every switch
  - Save debounce reduced 2000 ms → 300 ms — eliminates the stroke-loss window on canvas switch (300 ms is imperceptible; any deliberate switch takes longer); avoids per-stroke save costs while still being near-instant
  - `cloudSwitchRef` deduplicated: removed redundant `setActiveCanvas` + `localStorage.setItem` calls that were already performed by `onSwitchCanvas` before calling into the ref

- **Sharing portal** (`apps/unleashed/`)
  - Profile section added to `unleash.drawzil.la` homepage (shown for pro users only)
  - "Unleashed since Month Year" badge using `started_at` from `/stripe/status`; falls back to "Unleashed" for existing subscribers with no stored date
  - Lists all active shared canvases (`live`/`snap` labelled) and shared workspaces, each with copy-to-clipboard and "Unshare" button per row
  - Revoke canvas share: `DELETE /canvases/:id/share/:token`; revoke workspace share: `DELETE /workspaces/:id/share`; list refreshes after each revocation
  - "Manage subscription" button inline with subscription badge (opens Stripe portal); hero CTA hidden for Pro users (`hideIfPro`) to avoid duplicate button
  - Pricing card and £2.99/mo CTA hidden for existing subscribers; gated on `planKnown` (Clerk `isLoaded` + query settled) to prevent flash on reload
  - `GET /workspaces/shared` backend endpoint: joins `shares` → `canvases` → `workspaces` for canvas shares; separate query for workspace shares with `share_enabled = 1`
  - Profile card redesigned: dark `rgba(15,15,30,0.97)` background with subtle green glow border; type badges (live=green, snap=amber, workspace=blue); row hover states; scrollable list capped at ~8 visible rows

- **UI polish** (`apps/drawtool/`)
  - Top-left indicator: workspace name in `system-ui` (11px, uppercase, dim), canvas name/number in Caveat Brush — two-font approach chosen to give clear hierarchy without clutter
  - Share section: when both canvas and workspace unshared, two buttons collapse into a single `flex gap-1` row instead of stacking with dead space
  - UNLEASHED badge: animated green gradient "UNLEASHED" text shown in menu below the drawzilla logo for Pro users (`@keyframes unleashed-gradient` + `-webkit-background-clip: text`)
  - `stroke_count` column (migration 0008): stored on every canvas PUT; returned in `GET /workspaces`; shown per-row in `CanvasReorderPanel` cloud mode for all canvases (not just active)
  - `WorkspaceSwitcherModal` complete redesign: horizontal workspace pill strip replaces left sidebar; 3-column canvas card grid; card preview area with dotted placeholder for empty canvases; number badge top-left, stroke count bottom-right; edit/rename/delete with confirm overlay directly on cards; search results unchanged; footer simplified (no shortcuts text)
  - Canvas thumbnails: `generateCanvasThumbnail(strokes, isDark)` in `rendering.ts` — image strokes excluded, fits content with padding, returns JPEG dataURL; stored in `localStorage` as `drawtool-thumb-{canvasId}`; generated on initial canvas load from API, on every debounced save, and on canvas-switch flush; `WorkspaceSwitcherModal` reads localStorage on mount (zero Cloudflare calls for visited canvases) and fires parallel prefetch requests for unvisited non-empty canvases; each canvas is fetched at most once ever (localStorage prevents repeat calls)

- **Unleashed landing page polish** (`apps/unleashed/`)
  - Branding: drawzilla logo (Caveat Brush multicolor text + detailed SVG icon) in nav top-left; large hero version (80px icon, 4.5rem text) as page centrepiece
  - Scroll-collapse nav: hero logo is IntersectionObserver sentinel; nav slides in from top (`-translate-y-full` → `translate-y-0`) with blur backdrop once hero scrolls out of view — same pattern as eqipd-web
  - Color scheme changed from blue to toxic green (`#39ff14` / `#22cc10`) for all Unleashed UI accents; drawzilla logo letter colors unchanged
  - Footer: simplified bird SVG + small Caveat Brush text logo; Privacy / Terms / Support links
  - Favicon: copied from `apps/drawtool/public/favicon.png`; page title simplified to "drawzilla Unleashed" (price removed)
  - Data fetching migrated to React Query (`@tanstack/react-query`); `useSubStatus` and `useSharedItems` hooks use `useQuery` with `enabled: isLoaded && !!isSignedIn`; flash of pricing/CTA fixed by gating render on `planKnown = isLoaded && !statusLoading`
  - CORS allowlist in backend extended to `http://localhost:5175` (dev server port)
  - `html`/`body` background set to `#06060f` so overscroll doesn't reveal white
  - Logo extracted to `Logo.tsx` (exports `DrawzillaLogo`, `LOGO_LETTERS`, `DRAW_URL`) — shared across all pages
  - Privacy (`/privacy`) and Terms (`/terms`) pages: hand-written content, drawzilla header on each; pathname-based routing in `main.tsx` (no router dep); Privacy/Terms skip Clerk + React Query entirely
  - `public/_redirects` added for Cloudflare Pages SPA fallback
  - Shared items list: thin 4px custom scrollbar (CSS `scrollbar-thin` class); copy button gets `cursor-pointer`

### Deployment status

- **Not deployed.** Everything runs locally unless explicitly stated otherwise.
- All `wrangler` / `d1` commands should use `--local` by default. Never add `--remote` unless the user explicitly asks.
- Migrations 0001–0008 applied locally ✓. Migrations 0006–0008 applied to remote ✓ (0001–0005 were already on remote).
- `STRIPE_PRICE_ID` must be set as a secret (`wrangler secret put STRIPE_PRICE_ID`) before first remote deploy.
- First remote deploy checklist:
  1. ~~`npx wrangler d1 migrations apply drawzilla-db --remote`~~ ✓ (all 8 migrations now on remote)
  2. `wrangler secret put STRIPE_PRICE_ID`
  3. `npx wrangler deploy`
  4. Add Cloudflare WAF Rate Limiting rule: `POST /canvases/*/share` — 20 req/min per IP

### Pending / next

- **Share viewer design polish** — functional and read-only-safe; visual design still rough.
- **Prod deployment** — see deployment checklist in "Deployment status" above. Nothing is deployed yet.
- **Transactional email (nice-to-have)** — send a "your data will be deleted on {date}" email when a subscription enters `cancelling` state. Options: Resend (3k/mo free) or Cloudflare Email Workers + MailChannels (free, requires SPF/DKIM DNS). Stripe already handles receipts.

### Key decisions made
- Auth: Clerk (MAU-based billing, free to 10k MAU)
- Payments: Stripe (existing account, ~10% cut on £2.99)
- Infra: Cloudflare Workers + D1 + R2 (essentially free until meaningful scale)
- Cancellation: 30-day grace period with full Pro access; cron deletes data and restores blank free workspace
- Share links: frozen snapshots (7-day) for free signed-in; live permanent for Pro; both types use `savedDark` flag to ensure colours look right on any viewer theme
- Free signed-in users: 1 cloud workspace, 3 canvases, can create frozen share links, can view/fork shares
- Export: PNG watermarked for free, SVG gated (not watermarked — cleaner)
- Preferences: full settings object synced; `pressureSensitivity` and `shapeFillEnabled` intentionally included (user can override)
- No cookie banner needed (Clerk + Stripe are necessary-only cookies); Privacy Policy + ToS written by hand (no Iubenda/Termly)
- No real-time collaboration (deferred to v2)
