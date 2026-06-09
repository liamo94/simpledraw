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

## 6. Embed Widget ✅ Moderate backend + new viewer
**Scope:** Pro users get an `<iframe>` embed code for any shared canvas. The embed viewer is minimal (canvas only, no toolbar).

**Backend:**
- New route `GET /embed/:token` → same as share read but returns embed-specific metadata
- Reuse existing share token; no new token type needed
- Add `embed_enabled: boolean` flag to canvas share (so owner can allow share but disallow embed)

**Frontend:**
- Share modal: "Embed" tab (Pro only) with copy-able `<iframe src="https://drawzil.la/embed/:token" ...>` snippet
- New route `/embed/:token` in `main.tsx` → renders `EmbedViewer.tsx`
- `EmbedViewer.tsx`: stripped-down canvas viewer — no menu, no keyboard shortcuts, pan/zoom only, tiny "Made with drawzilla" badge in corner
- Respects expiry and password protection from feature #3

---

## 7. Presentation Mode ✅ Most complex, all frontend
**Scope:** Users bookmark named viewport positions ("slides") and step through them in sequence. Works in the canvas and in share/embed viewers.

**Data model:**
```ts
type Slide = { id: string; name: string; view: { x: number; y: number; scale: number } };
```
Stored as `slides?: Slide[]` on the canvas JSON (alongside `strokes`).

**Editing (canvas owner):**
- "Slides" panel in `Menu.tsx` (Pro only)
- "Add slide" captures current `view` → appended to slide list with auto-name ("Slide 1", etc.)
- Slides reorderable (drag) and renameable inline
- "Present" button enters presentation mode

**Presentation mode:**
- Full-screen overlay; hides all toolbar chrome
- Arrow keys / on-screen prev/next buttons navigate between slides
- Smooth animated pan/zoom transition between viewport positions (lerp over ~400ms)
- `Esc` exits back to editing mode

**Share/embed viewer:**
- If canvas has slides, show a "Present" button in share viewer
- Embed viewer: if `?present=1` query param, auto-starts in presentation mode with nav arrows

---

## Order of attack

| # | Feature | Backend? | Effort |
|---|---------|----------|--------|
| 1 | PDF Export | No | S |
| 2 | Share View Counts | Yes | S |
| 3 | Expiring / Password Shares | Yes | M |
| 4 | Custom Themes | No | M |
| 5 | Canvas Version History | Yes | L |
| 6 | Embed Widget | Yes | M |
| 7 | Presentation Mode | No | L |
