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

## 3. Expiring / Password-Protected Share Links ✅ Moderate backend + frontend
**Scope:** Pro users can optionally set an expiry date and/or a passcode on a share link.

**Backend:**
- Add columns to shares table: `expires_at DATETIME`, `password_hash TEXT`
- `POST /canvases/:id/share` and workspace equivalent: accept optional `expires_in_days` and `password` fields
- On share fetch: return 410 Gone if expired, 401 if password required (with a flag `password_required: true`)
- Password check: separate `POST /share/:token/unlock` endpoint that returns a short-lived session token (stored in sessionStorage on client)

**Frontend:**
- Share modal: expiry picker (7 / 30 / 90 days / never) and password field (Pro only)
- Share viewer (`ShareViewer.tsx`): handle 410 (expired notice) and 401 (password entry form before showing canvas)

---

## 4. Custom Themes / Brand Colors ✅ Frontend only
**Scope:** Pro users can define a custom background color (and optionally a default stroke color). Free users see the existing 8 themes only.

- Add `"custom"` to the `theme` type in `useSettings.ts`
- Add `customThemeBg: string` and `customThemeStroke: string` to settings
- In `Menu.tsx`: after the 8 theme swatches, show a `+` custom color picker (Pro only; locked icon for free)
- `getBackgroundColor()` in `canvasUtils.ts`: handle `"custom"` by returning `customThemeBg`
- `adaptStrokes()` in `rendering.ts`: treat custom theme like the nearest light/dark equivalent for stroke re-adaptation

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
