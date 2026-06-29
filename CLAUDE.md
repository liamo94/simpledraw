# drawtool monorepo — CLAUDE.md

Four apps deployed on Cloudflare Pages + one Cloudflare Worker backend:
- **drawzil.la** — infinite-canvas drawing tool (`apps/drawtool/`)
- **writing.drawzil.la** — freehand handwriting practice game (`apps/writing/`)
- **use.drawzil.la** — marketing homepage (`apps/homepage/`)
- **unleash.drawzil.la** — Unleashed subscription landing page (`apps/unleashed/`)
- **API** — Cloudflare Worker backend (`/Users/liam/Documents/dev/drawzilla-backend/`)

Built with React 19 + TypeScript + Vite + Tailwind v4.

## Monorepo structure

```
/                               # pnpm workspace root
  package.json
  pnpm-workspace.yaml           # workspaces: ["apps/*"]
  .npmrc                        # prefer-offline=true
  apps/
    drawtool/                   # drawzil.la
    writing/                    # writing.drawzil.la
    homepage/                   # use.drawzil.la (marketing homepage)
    unleashed/                  # unleash.drawzil.la (Stripe subscription page)
```

Backend lives separately at `/Users/liam/Documents/dev/drawzilla-backend/` — Hono on Cloudflare Workers, D1 (SQLite), R2 (canvas storage), Clerk JWT auth.

## Dev commands

> Do not run `pnpm dev` — the user runs the dev server themselves.

```bash
# From root (convenience scripts)
pnpm build:drawtool
pnpm build:writing

# Or from each app dir
cd apps/drawtool && pnpm build
cd apps/writing  && pnpm build
```

## Cloudflare Pages deployment
Each app is its own Cloudflare Pages project with root directory set to its app folder:
- drawtool: root dir = `apps/drawtool`, build = `npm run build`, output = `dist`
- writing:  root dir = `apps/writing`,  build = `npm run build`, output = `dist`

---

## Cloud & auth (`apps/drawtool/`)

**Auth**: Clerk (`@clerk/clerk-react`). `useUser()` / `useAuth()` / `useClerk()`. Never show user email in UI (privacy — users may be streaming).

**Plan**: `useUserPlan()` in `src/hooks/useUserPlan.ts` — fetches `/stripe/status`, returns `{ isPro, canvasLimit }`. Free = 3 canvases, Pro = 9.

**Cloud canvas**: `useCloudCanvas()` in `src/hooks/useCloudCanvas.ts`.
- Cloud users always use slot 1 as write-through cache. `activeId` (cloud canvas UUID) stored in `localStorage('drawtool-cloud-active-canvas')` to avoid flash on load.
- Save hook debounces 300ms then PUTs to `/canvases/:id`. Includes images as base64 (see below).
- `fetchWorkspace()` loads all metadata; `switchCanvas()` flushes current before loading next.
- Canvas query uses `staleTime: Infinity`, `refetchOnWindowFocus: false` — critical. Default `refetchOnWindowFocus: true` would bump `loadKey` mid-draw, remounting Canvas with stale server strokes.
- `loadKey` counter: incrementing it remounts Canvas, which re-reads slot 1 from localStorage. The canvas query effect bumps `loadKey` after writing server data to slot 1.
- `DIRTY_KEY = 'drawtool-cloud-dirty'` (localStorage): set when local strokes change, stored as the active canvas ID. Canvas query effect skips overwriting slot 1 if flag matches the active canvas. Cleared when server confirms the save. Prevents erase-then-refresh race: `keepalive` PUT from `onBeforeUnload` races against new page's query; dirty flag wins.
- `onBeforeUnload` always saves (no early-return guard) — ensures viewport position is persisted even in pan-only sessions.
- `planLoading` = `!clerkLoaded || (isPending && isSignedIn === true)` — `clerkLoaded` from `useUser().isLoaded` gates it during Clerk boot to prevent Unleashed button flash.

**Image sync** (`src/canvas/imageStore.ts`):
- Images stored in IDB locally. On cloud load, also embedded as base64 in R2 JSON (`images?: Record<string, string>`).
- `collectImages(strokes)` — async, reads IDB by image ID, returns base64 map. Used in save and `flushCurrentCanvas`.
- `collectImagesSync(strokes)` — sync, reads in-memory cache only. Used in `onBeforeUnload` (can't await in beforeunload).
- On canvas query success: async IIFE stores images in IDB first, then writes strokes to slot 1, then bumps `loadKey`. This ensures images are in IDB before Canvas mounts.
- Migration and share fork also collect and embed images.

**Sharing**:
- Free users: canvas shares only (live, naturally capped at 3 by canvas limit). Share token = 16 hex chars.
- Pro users: canvas + workspace shares (both live).
- Share viewer at `/s/:token` (canvas) and `/s/w/:token` (workspace) — rendered by `ShareViewer.tsx`, uses canvas slot 10.
- `share_token` / `share_enabled` returned on every workspace fetch so share state persists across sessions.
- ShareViewer keyboard shortcuts: `g`/`G` cycles grid, double-`d`/`D` (within 400 ms) cycles theme. Stroke colours re-adapted on theme change via `adaptStrokes()`. Uses `shareDataRef` / `activeIndexRef` to avoid stale closure in effect.
- ShareViewer `loadSlot` is async — stores images in IDB (via `storeImage`) before `setCanvasKey`, so Canvas mounts only after images are available.

**Export**:
- PNG: free users get "drawzilla [icon]" watermark (Caveat Brush font, colored letters). Pro = clean.
- SVG: Pro only (shown as locked in menu for free users).
- Watermark logic in `src/canvas/watermark.ts`, uses `document.fonts.load()` before drawing.

**Backend routes** (`drawzilla-backend/src/routes/`):
- `workspaces.ts` — CRUD + share (workspace share = Pro only)
- `canvases.ts` — CRUD + share (canvas share = all signed-in users)
- `share.ts` — public read routes for share viewer
- `stripe.ts` — checkout, portal, webhook, status

---

## drawtool app (`apps/drawtool/`)

```
src/
  App.tsx                        # Root: settings, canvas switching, event orchestration
  main.tsx                       # Entry point — also handles /s/* share routes → ShareViewer
  components/
    Canvas.tsx                   # Core drawing logic — input, rendering, undo, tools
    Menu.tsx                     # Toolbar UI (top/bottom bars, mobile controls)
    ShareViewer.tsx              # Public share viewer (/s/:token, /s/w/:token)
    ShortcutsPanel.tsx           # Keyboard shortcuts overlay
    MigrationModal.tsx           # One-time local→cloud migration prompt
  hooks/
    useSettings.ts               # Persisted settings hook (localStorage, debounced)
    useKeyboardShortcuts.ts      # All keyboard bindings
    useTextSelection.ts          # Text tool selection helpers
    useCloudCanvas.ts            # Cloud canvas CRUD, switching, share/unshare
    useUserPlan.ts               # Fetches /stripe/status → { isPro, canvasLimit }
    useMigration.ts              # Local→cloud migration logic
  canvas/
    types.ts                     # Stroke, UndoAction, BBox, TouchTool, CanvasSnapshot
    geometry.ts                  # Math helpers: screenToWorld, distToSegment, buildFont, etc.
    rendering.ts                 # All canvas drawing: freehand, shapes, text, themes
    canvasUtils.ts               # Barrel re-export of all canvas/* modules
    storage.ts                   # localStorage read/write for strokes + view
    svgExport.ts                 # SVG export logic (Pro only)
    watermark.ts                 # PNG watermark for free users — drawWatermark()
```

## writing app (`apps/writing/`)

A handwriting tracing practice game. Users see a faint ghost letter/word and draw over it freehand. Scoring uses pixel-comparison (coverage + precision).

```
src/
  App.tsx                        # Game state: mode, target, score, reset flow
  main.tsx
  components/
    TraceCanvas.tsx              # Ghost rendering + freehand capture + ✓ check button
    ScoreDisplay.tsx             # Score overlay with verdict + Next/Try again
  lib/
    content.ts                   # Letter/number/word pools, getTarget(), getFontSize()
    freehand.ts                  # smoothPoints(), renderStroke() — adapted from drawtool
    scoring.ts                   # scoreAttempt(): pixel-comparison, returns 0-100
```

### Scoring algorithm
1. Render target text to offscreen canvas A (white fill)
2. Render user strokes to offscreen canvas B (white)
3. Read pixel alpha from both via `getImageData()`
4. `coverage = overlapping_px / target_px`
5. `precision = overlapping_px / user_px`
6. `score = round((coverage × 0.6 + precision × 0.4) × 100)`

### Game flow
- Mode tabs: A–Z | a–z | 0–9 | Words
- Draw freely → tap ✓ button → score overlay appears
- "Try again" remounts canvas with same target; "Next →" picks a new target

---

## drawtool app architecture (`apps/drawtool/`)

### Component communication
Canvas.tsx, App.tsx, and Menu.tsx communicate via a custom event bus:
```ts
window.dispatchEvent(new CustomEvent("drawtool:toolchange", { detail: ... }))
```
Do not add direct prop callbacks for cross-component actions — use the event bus.

### State management rules
- **Rendering state uses `useRef`**, not `useState`. This avoids re-render thrash on every pointer move.
- Settings values passed as props to Canvas are **mirrored into refs** inside Canvas (e.g. `textSizeRef.current = textSize`).
- Settings are managed by `useSettings` in App.tsx and flow down as props to Canvas.
- Undo/redo stacks are refs inside Canvas.tsx; mutations are **in-place on the stroke object**.

### Multiple canvases
App.tsx supports 9 canvas slots (1–9), stored separately in localStorage as `drawtool-strokes-{n}`. The `/new` URL route auto-selects the first empty slot.

## Key data types (`src/canvas/types.ts`)

```ts
type Stroke = {
  points: { x: number; y: number }[];
  style: "solid" | "dashed";
  lineWidth: number;
  color: string;
  shape?: ShapeKind;        // if set, drawn as a geometric shape
  text?: string;            // if set, drawn as text
  highlight?: boolean;
  fill?: FillStyle | boolean;
  seed?: number;            // roughjs seed for stable re-render
  // ... font/text properties
};

type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[] }
  | { type: "move"; stroke: Stroke; from: ...; to: ... }
  // ... many more
```

Shapes are just `Stroke` objects with a `shape` field set. Text strokes have `text` set and `points[0]` as the anchor.

## Tools / TouchTool

`"draw" | "dashed" | "line" | "erase" | "hand" | "shape" | "highlight" | "laser" | "spray" | "text" | "select"`

## Settings (`src/hooks/useSettings.ts`)

Persisted to `localStorage` under key `drawtool-settings`. Debounced 300ms, flushed on unmount + `beforeunload`.

Key settings:
- `theme`: `"dark" | "midnight" | "lumber" | "white" | "journal" | "sky" | "slate" | "sand"`
- `activeShape`: `"line" | "circle" | "rectangle" | "triangle" | "star" | "arrow" | "pentagon" | "hexagon" | "diamond" | "cloud"`
- `shapeFill` / `shapeFillEnabled` / `fillOpacity` / `shapeDashed` / `shapeCorners`
- `fontFamily`: `"caveat" | "sans" | "serif" | "mono" | "comic" | "cartoon"`
- `textSize`: `"xs" | "s" | "m" | "l" | "xl"`
- `gridType`: `"off" | "dot" | "square"`
- `pressureSensitivity`: boolean (stylus pressure via `getCoalescedEvents`)

## Rendering (`src/canvas/rendering.ts`)

- Freehand strokes use **perfect-freehand** for pressure-sensitive paths.
- Shapes use **roughjs** for a hand-drawn look. Each shape has a stable `seed` so it doesn't re-render differently.
- Cloud shape uses bezier curves in normalized 0–100 space, then pre-scales to an SVG path string passed to `rc.path()`.
- Text uses `buildFont(basePx, bold?, italic?, fontFamily?)` to build `ctx.font`.
- For center-aligned text, `bbox.x = anchor.x - w / 2`; for right-aligned, `bbox.x = anchor.x - w`. The `anchor.x` is always the reference point.
- Theme background colors: `getBackgroundColor(theme)` in `canvasUtils.ts`.

## Coordinate system

All strokes store **world coordinates**. The canvas has a `view: { x, y, scale }` panned/zoomed transform applied each frame. Use `screenToWorld(sx, sy, view)` from `geometry.ts` to convert pointer events.

## Keyboard shortcuts (macOS gotchas)

- On macOS, `e.key` is **lowercase** when Cmd is held, even with Shift. `Cmd+Shift+Z` → `e.key === "z"`, `Cmd+Shift+L` → `e.key === "l"`.
- `Shift` alone → uppercase: `Shift+T` → `e.key === "T"`.
- When `isWritingRef.current` is true (text editing mode), the writing block returns early — main key handlers are **not reached**.

## SVG icons (mobile toolbar)

- All icons: `viewBox="0 0 20 20"`, `width="20" height="20"`, `strokeWidth="1.75"`.
- Content should fill ~75–80% of viewBox height for consistent visual weight.
- Square viewBox renders square regardless of element `w`/`h` — changing only height does nothing.

## Storage

- Strokes: `drawtool-strokes-{n}` — JSON array of `Stroke[]`, capped at 5MB.
- View: `drawtool-view-{n}` — `{ x, y, scale }`.
- Settings: `drawtool-settings`.
- Active canvas: `drawtool-active-canvas`.
- Old single-canvas key `drawtool-strokes` is migrated to `drawtool-strokes-1` on first load.

## Adding a new shape

1. Add the name to `ShapeKind` in `useSettings.ts`.
2. Add it to the `SHAPES` array in `App.tsx`.
3. Add rendering logic in `rendering.ts` (find the shape dispatch block).
4. Add a toolbar icon/button in `Menu.tsx`.
