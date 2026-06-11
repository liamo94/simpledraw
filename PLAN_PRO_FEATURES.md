# Pro Features Plan

Ordered roughly by complexity. Tackle one at a time.

---

## 1. PDF Export ✅ DONE
**Scope:** Pro-only export option alongside existing PNG/SVG.

- `jspdf` installed (lazy-loaded — only downloads on first PDF export)
- Fit-to-content: renders all strokes to 2× offscreen canvas, PDF page sized to match
- White background; dark-theme canvases have `#ffffff` strokes swapped to `#000000`
- PDF pill added to format selector in `Menu.tsx` (Pro-locked, same as SVG); transparent toggle hidden when PDF selected
- `Cmd+E` shortcut respects PDF format selection
- Dispatches via `drawtool:export-pdf` event → handled in `Canvas.tsx` (same pattern as SVG/transparent)

---

## 2. Share View Counts ✅ DONE
**Scope:** Track and display how many times a shared canvas/workspace has been viewed.

**Backend (`drawzilla-backend`):**
- `view_count INTEGER DEFAULT 0` added to `shares` and `workspaces` tables (migration `0013_view_counts.sql`)
- Incremented via `waitUntil` on `GET /share/:token` and `GET /share/workspace/:token`
- Returned in `GET /canvases/:id/shares` and `GET /workspaces/shared` responses

**Frontend:**
- Shown in the Unleashed "Shared publicly" panel — eye icon + count next to each share row (hidden when 0)
- `view_count` carried in `ShareLink` and `CloudWorkspace` types in `useCloudCanvas.ts`
- Not shown in the drawtool share modal (Unleashed is the right place for stats)

---

## 3. Expiring / Password-Protected Share Links ✅ DONE
**Scope:** Pro users can optionally set an expiry date and/or a passcode on a share link.

**Backend (`drawzilla-backend`):**
- Migration `0014_share_passwords.sql`: added `password_hash TEXT` to `shares` table (`expires_at` already existed)
- `src/utils/crypto.ts`: SHA-256+salt password hashing, HMAC-SHA256 access token (1h TTL) signed with `ADMIN_SECRET`
- `POST /canvases/:id/share`: Pro users can pass `expires_in_days` (7/30/90) and `password`
- `PATCH /canvases/:id/share/:token`: Pro-only, updates expiry/password; only recalculates expiry if `expires_in_days` explicitly sent (preserves existing otherwise)
- `GET /share/:token`: returns 410 if expired, 401 `{ password_required: true }` if locked
- `POST /share/:token/unlock`: verifies password, returns short-lived HMAC access token
- `cleanupExpiredShares` now deletes all expired shares (live + frozen), not just frozen
- CORS: added `X-Access-Token` to `allowHeaders`

**Frontend:**
- Share modal: Pro-only expiry pill picker (7d / 30d / 90d / ∞) and password field with eye toggle
- Edit panel: gear icon on existing live shares; pre-selects current expiry; can change password or remove it; Cancel/Save buttons; expiry only re-sent if user changed the pill
- `ShareViewer.tsx`: 410 expired screen, 401 password gate (Enter key, autoFocus); access token stored in `sessionStorage`, sent as `X-Access-Token` header on retry

---

## 4. Custom Themes / Brand Colors ✅ DONE
**Scope:** Pro users can pick any background color. Dark/light detection is automatic. Menu/panel color auto-derived.

- `"custom"` added to `Theme` type; `customThemeBg: string` added to `Settings` (default `#1a1040`)
- `rendering.ts`: `hexLuminance()` + `isColorDark()` for luminance-based dark/light detection
- All 4 theme functions (`getBackgroundColor`, `getPanelBackground`, `getGridColor`, `isDarkTheme`) updated to accept optional `customBg?: string` and handle `"custom"` theme
- `getPanelBackground` for custom: shifts RGB ±18/12 from bg color (lighten for dark, darken for light) with 0.92/0.97 opacity
- Canvas.tsx: `customThemeBgRef` prop; theme-swap effect uses `prevIsDarkRef` instead of `prevThemeRef` — detects polarity changes even mid-custom-color
- All components that use theme functions (App.tsx, Canvas.tsx, Menu.tsx, SelectControls, StashPanel, WorkspaceSwitcherModal, ShareViewer) updated to pass `customThemeBg`
- Menu.tsx (Pro only): pipette icon opens color picker; small rounded square swatch activates custom theme without opening picker; active swatch has outer ring for clarity

## 4a. Recent Colors + Settings Sync ✅ DONE
**Scope:** Custom color picker gains a recents history; all signed-in users get settings synced across devices.

**Recent colors:**
- `recentColors: string[]` added to `Settings` (default `[]`, max 8)
- Populated only via the pipette (not palette clicks); deduped, newest first
- Shown as a 4-column grid popover triggered by a chevron button to the left of the pipette (Pro only); selecting a recent updates `customColor` and applies the color immediately
- Dropdown resets when menu panel closes

**Settings sync (`usePreferencesSync.ts`):**
- Uses existing `/preferences` GET/PUT endpoint — no backend changes or migrations needed
- All signed-in users sync (not Pro-gated)
- Split into two buckets stored as `{ synced, prefs }`:
  - **Synced** (backend always wins on load): `lineColor`, `customColor`, `recentColors`, `customThemeBg`, `lineWidth`, `dashGap`, font/text settings, shape settings, export format
  - **Local-first** (seeds new device only; localStorage wins once set): `theme`, `gridType`, `pressureSensitivity`, display toggles, click tools
- New-device detection via `drawtool-settings-initialized` localStorage flag
- Legacy flat format detected and migrated to new `{ synced, prefs }` shape on first load
- 800 ms debounce on PUT; clears on sign-out

---

## 5. Canvas Version History ✅ Significant backend + new UI
**Scope:** Auto-snapshot canvas every N saves. Pro users can browse and restore snapshots.

**Backend:**
- New `snapshots` table: `id, canvas_id, created_at, data TEXT` (same JSON shape as a canvas save)
- On `PUT /canvases/:id`: if Pro user, write snapshot every 5 saves (track `save_count` on canvas row, or time-based: max 1 snapshot per 5 min)
- Retention: keep last 30 snapshots per canvas; prune oldest on write
- New routes:
  - `GET /canvases/:id/snapshots` → list `{ id, created_at, stroke_count }`
  - `GET /canvases/:id/snapshots/:snapId` → full snapshot data
  - `POST /canvases/:id/snapshots/:snapId/restore` → overwrites current canvas data

**Frontend:**
- History panel in `Menu.tsx` (Pro only): list of snapshots with relative timestamps
- "Restore" button: calls restore endpoint, bumps `loadKey` to remount canvas
- Preview on hover (optional, v2): render snapshot to small offscreen canvas

---

## 6. Embed Widget ✅ DONE
**Scope:** Pro users get an `<iframe>` embed code for any shared canvas. The embed viewer is minimal (canvas only, no toolbar).

- No backend changes needed — reuses existing share token and `GET /share/:token` endpoint
- `/embed/:token` route added in `main.tsx` → renders `ShareViewer` with `embedded` prop
- `ShareViewer.tsx`: `embedded` prop hides header entirely; small drawzilla logo + text badge in bottom-right corner links back to drawzil.la
- Canvas-only embeds; workspace tokens on the embed route show the standard error screen
- `</>` icon button added to each live Pro canvas share row in the menu — copies `<iframe>` snippet to clipboard
- Respects expiry and password protection from feature #3

---

## 7. Presentation Mode ✅ DONE

**Scope:** Users bookmark named viewport positions ("slides") and step through them in sequence. Multi-canvas workspace aware. Shareable via workspace share links.

**Data model:**
```ts
type Slide = {
  id: string;
  name: string;
  canvasIndex: number;   // local slot index (1–9)
  canvasId?: string;     // cloud UUID for cross-canvas identification
  canvasName?: string;   // display label in panel
  view: { x: number; y: number; scale: number };
  thumbnail?: string;    // base64 data URL, not persisted to cloud
};
```
Slides stored in localStorage per workspace key; synced to `workspaces.slides_json` on backend for sharing (thumbnails stripped before upload).

**Editing (canvas owner):**
- Dedicated `SlidesPanel.tsx` component (280px right drawer, same glass-morphism style as other panels)
- `Shift+N` adds current viewport as a new slide (also "+ Add slide" button in panel header)
- `Shift+P` enters presentation mode
- Slides show a 16:9 thumbnail (canvas screenshot), slide number badge, hover actions (navigate / delete)
- Drag-to-reorder; double-click name to rename inline
- Canvas label shows which canvas each slide belongs to (+ "· here" indicator for active canvas)
- "▶ Present" button in panel footer

**Presentation mode:**
- Full-screen overlay; arrow keys left/right/up/down to step through slides
- On-screen prev/next chevron buttons + slide name + "X / N" counter at bottom
- "Exit" button (top-right) or `Esc` to return to editing
- Smooth animated pan/zoom transition (lerp ~400ms, same as `navigate-slide` event handler in Canvas.tsx)
- Keyboard arrow keys blocked from panning canvas while in presentation mode (`presentationModeRef` guard in `useKeyboardShortcuts`)
- **Multi-canvas**: slides referencing a different canvas trigger an async cloud switch; `navigateToSlide` uses `cloudActiveIdRef` / `activeCanvasRef` (not closure values) to avoid stale-ID bug after async switch

**Sharing:**
- Backend: migration `0016_workspace_slides.sql` adds `slides_json TEXT DEFAULT NULL` to `workspaces`; workspace `PATCH /:id` handles `{ slides }` body; workspace share `GET /share/workspace/:token` includes `slides` in response
- Debounced cloud sync in App.tsx (1500ms, Pro cloud users only)
- `SlidesPanel`: "Copy presentation link" button appears when workspace share is active — copies share URL, shows "✓ Copied!" for 2 s
- `ShareViewer`: workspace `ShareData` type includes `slides?: Slide[]`; "Present" button appears in header when slides exist; cross-canvas navigation loads the correct canvas with slide's view override via `loadSlot(..., viewOverride)`

**Polish / bug fixes:**
- Cover div uses `getBackgroundColor(...)` (solid hex) not `getPanelBackground` (semi-transparent) — prevents strokes bleeding through while loading
- Two-path cover drop: `presentationWaitingForCloudLoad` + `presentationCloudCacheHit` refs distinguish cache-miss (wait for `loadKey` bump) from cache-hit (drop on `activeCanvas` change) — fixes cover getting stuck on cached canvases
- Prefetch all slide canvas IDs when slides panel opens (`cloudCanvas.prefetchCanvases`) — fixes blank screen on first presentation start when on a different canvas
- `generateSlideThumbnail` renders to offscreen canvas at stored `slide.view`, not live canvas position — thumbnails never drift after pan/zoom
- Thumbnails auto-refreshed on every slide navigation (no manual refresh button)
- Toast "Slide added" shown for 2 s when a slide is added
- Escape key closes the slides panel

---

## Order of attack

| # | Feature | Backend? | Status |
|---|---------|----------|--------|
| 1 | PDF Export | No | ✅ Done |
| 2 | Share View Counts | Yes | ✅ Done |
| 3 | Expiring / Password Shares | Yes | ✅ Done |
| 4 | Custom Themes | No | ✅ Done |
| 4a | Recent Colors + Settings Sync | No | ✅ Done |
| 5 | Canvas Version History | Yes | ⏳ Not started |
| 6 | Embed Widget | No | ✅ Done |
| 7 | Presentation Mode | Yes (slides sync) | ✅ Done |
