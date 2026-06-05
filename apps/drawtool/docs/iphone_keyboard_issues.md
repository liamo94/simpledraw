# iPhone Keyboard Issues — Full Debug Log

## Goal

Two flows must work on iOS:

1. **Text-tool mode**: tap text tool → tap canvas → keyboard opens → type → press Done → text committed
2. **Select-mode editing**: select tool → tap text stroke → double-tap it → keyboard opens → type → press Done → text committed

---

## Architecture

- A hidden `<textarea>` (the "input sink") lives outside the canvas. It captures all keyboard input.
- The canvas renders text visually using refs. The textarea is invisible; only its events matter.
- Writing mode: `isWritingRef.current`. `onInput` on the textarea reads `ta.value`, updates `writingTextRef`, redraws.
- Commit: `finishWriting()` saves the stroke, dispatches `drawtool:writing` (detail:false) → `ta.blur()`.
- **iOS constraint**: `ta.focus()` only opens the soft keyboard when called as a **direct result of a user gesture** (touchstart/touchend/pointerdown). Async calls, custom event dispatch, promises — none of these work.
- **iOS constraint**: `opacity: 0` elements refuse keyboard focus even with explicit `focus()` in gesture context. Must use `opacity: 0.01` minimum.

---

## Attempt 1 — Full-screen textarea overlay (commit `372e358`)

**What**: Added a full-screen transparent textarea overlay (`position:fixed; inset:0`) when `touchTool === "text"`. User's tap lands on the textarea, browser auto-focuses it, keyboard opens. Added `onBlur` handler: `if (isWritingRef.current) finishWriting()` to detect Done press.

**Result**: Broke desktop double-click editing — `onBlur` fired during the double-click sequence and immediately ended writing.

---

## Attempt 2 — 250ms onBlur guard

**What**: `if (Date.now() - writingStartTime < 250) return;` before calling `finishWriting` in `onBlur`.

**Theory**: Spurious blur from desktop double-click fires within ~100ms. 250ms guard filters it.

**Result**: Desktop fixed. iOS keyboard opens but **editing doesn't work** — text typed doesn't appear. `finishWriting` likely called at >250ms due to another iOS blur, setting `isWritingRef = false` before user types, so `onInput` returns early.

---

## Attempt 3 — Touch guard in `handlePointerDownForText`

**What**: `if (e.pointerType === "touch" && !editStroke) return` before the `finishWriting()` call, to prevent a second tap from ending a new-text session.

**Theory**: A second tap on the full-screen overlay while writing was calling `finishWriting()`.

**Result**: Same issue.

---

## Attempt 4 — Skip `ta.focus()` for iOS text-tool tap

**What**: In `onWriting`, skip the `ta.setSelectionRange` + `ta.focus()` call when `isTouchDevice && touchToolRef.current === "text"`.

**Theory**: Browser auto-focuses the textarea (it's the tap target). Calling `ta.focus()` on top creates a double-focus cycle → brief blur → keyboard flash.

**Result**: Same issue. (Applied and reverted multiple times.)

---

## Attempt 5 — Disable `onBlur` entirely for touch + `visualViewport.resize`

**What**:
- `onBlur`: return immediately when `isTouchDevice`
- `window.visualViewport.addEventListener("resize", ...)`: when viewport height grows >150px while writing, call `finishWriting()` (keyboard dismissed = Done pressed)
- Restored `ta.focus()` call (reverted Attempt 4)

**Theory**: iOS fires spurious blurs at unpredictable times. Skip blur entirely on touch. Use viewport-grow as the "Done" signal.

**Result**: Worse — "keyboard briefly splashes and edit goes off." The `visualViewport` listener was triggered by the brief keyboard-close from the double-focus cycle (browser auto-focus + our `ta.focus()` both firing).

---

## Attempt 6 — visualViewport + 500ms startup guard + re-apply Attempt 4 + extend pen guard

**What**:
- Re-applied Attempt 4 (skip `ta.focus()` for iOS text-tool mode)
- Added `Date.now() - writingStartTime > 500` guard to `onVVResize`
- Extended touch guard to also cover Apple Pencil (`e.pointerType === "pen"`) in text-tool mode

**Theory**: Attempt 4 avoids the double-focus that triggered the visualViewport listener. 500ms guard is a safety net.

**Result**: Keyboard doesn't open at all. Removing `ta.focus()` meant the browser's auto-focus was the only mechanism — not reliable enough (or not happening at all).

---

## Attempt 7 — `ta.focus()` directly in `handlePointerDownForText` + skip in `onWriting`

**What**:
- Moved `ta.focus()` to fire directly inside the pointer event handler (`handlePointerDownForText`), before `startWriting()`, for text-tool mode
- Skipped `ta.focus()` in `onWriting` for all iOS (not just text-tool mode) — calling focus inside `window.dispatchEvent` is untrusted on iOS
- Extended `onBlur` skip to all touch devices (not just a guard)
- `visualViewport` 1500ms startup guard (up from 500ms)

**Theory**: Mirrors what tldraw/excalidraw do — focus is a direct gesture response, not mediated through custom event dispatch.

**Result**: Text-tool mode improved. But select-mode double-tap still broken — keyboard briefly opens then closes.

---

## Attempt 8 — `opacity: 0.01` on both textarea styles

**What**: Changed `opacity: 0` → `opacity: 0.01` on both:
- Full-screen overlay (text-tool mode)
- Small hidden textarea (other modes)

**Why discovered**: iOS WebKit refuses keyboard for `opacity: 0` elements even with explicit `focus()` in user-activation context.

**Result**: Text-tool mode likely fixed. Select-mode double-tap: keyboard opens ("more than a flicker") but still closes before user can type.

---

## Attempt 9 — `onCanvasTouchStartForEdit` native listener

**What**: Added a native `touchstart` listener on the canvas element. When `lastTextTapRef` has a recent tap (< 300ms ago), calls `ta.focus()` in the native handler (guaranteed iOS user-activation context).

**Theory**: React's synthetic `onPointerDown` may not fully preserve iOS user-activation for `focus()`. A native canvas touchstart fires earlier and is definitively in the gesture chain.

**Result**: Introduced regression — keyboard opens on **single tap** to select text, not just double-tap. Root cause: `lastTextTapRef` is set after first tap by React's handler; the native canvas touchstart on the NEXT tap (even a single tap) fires before React and sees the ref as non-null within 300ms.

---

## Attempt 10 — `last.stroke !== selectedTextRef.current` guard + touch guard fix (current)

**What**:
1. `onCanvasTouchStartForEdit`: added `if (last.stroke !== selectedTextRef.current) return;` — only pre-focus when the previous tap was on the currently-selected stroke (genuine double-tap on same stroke, not stale ref or unrelated tap)
2. `handlePointerDownForText` line 420: changed `!editStroke` guard to `if (e.pointerType === "touch") return;` — touch never finishes on outside-bbox tap regardless of whether editing new or existing text

**Theory**:
- Fix 1 prevents keyboard on single tap: after the first tap, `selectedTextRef.current` is set to the tapped stroke. A second tap on the SAME stroke → `last.stroke === selectedTextRef.current` → pre-focus fires. Any other tap (different stroke, blank canvas, stale ref) → skipped.
- Fix 2 prevents keyboard closing: previously `!editStroke` meant the guard was skipped for existing-stroke sessions → any outside-bbox touch called `finishWriting()`. Now touch always returns early; committing only via Done button (visualViewport) or tool switch.

**Status**: Confirmed still not working.

---

## Attempt 11 — Full-screen textarea on iOS + 2-tap edit flow + 500ms window

**Root cause analysis**:

Two bugs compounding:

1. **1×1px textarea**: The non-text-tool textarea was 1×1px positioned in the top-left corner. iOS likely won't open the keyboard for such a small/corner element even with explicit `focus()` in a gesture context. Text-tool mode worked because it had a full-screen overlay.

2. **3-tap flow instead of 2-tap**: The first tap in select mode (selecting the stroke via the `zKeyRef/select` path) never set `lastTextTapRef`. So the "first tap" for double-tap detection was actually the SECOND user tap, requiring a third tap within 300ms to enter edit mode. Users were doing 3 taps instead of the expected 2.

**What changed**:

1. `Canvas.tsx` textarea style: **always full-screen on iOS** (`position: fixed; inset: 0; width: 100%; height: 100%`), regardless of tool mode. `pointerEvents: "auto"` only in text-tool mode (where the overlay is the tap target); `"none"` all other times so touches pass through to canvas.

2. `useTextSelection.ts` — `zKeyRef/select` first-tap path: **set `lastTextTapRef`** when a text stroke is selected via touch, enabling 2-tap editing (select + tap-within-500ms = edit).

3. `useTextSelection.ts` — "clicked elsewhere" path: **set `lastTextTapRef`** when a new text stroke is selected via touch (same fix for the case where A was selected and user taps B).

4. Double-tap detection: **increased window from 300ms → 500ms** (more forgiving of human tap speed), plus added **bbox check** (tap must be on the stroke, not outside it).

5. `onCanvasTouchStartForEdit`: signature `(e: TouchEvent)`, added **bbox check** (pre-focus only when touch is on the stroke), **increased window to 500ms**.

**Status**: Introduced 3 regressions — see Attempt 12.

---

## Attempt 12 — pointer-events management + native startEditingStroke + outside-bbox commit

**Regressions from Attempt 11**:
1. "Keyboard appears on select text (wrong, too early)" — two `ta.focus()` calls in quick succession (native pre-focus + React double-tap focus) created a flash/close cycle that users perceived as keyboard opening at the wrong time.
2. "Double tapping in edit mode, keyboard disappears" — with `pointer-events: none` on textarea while writing, iOS auto-blurs the focused textarea when the user's touch is routed to the canvas, closing the keyboard.
3. "Clicking off text doesn't cancel edit mode / can't select anything else" — `if (e.pointerType === "touch") return;` was unconditional, preventing any touch tap from committing the text.

**What changed**:

1. `Canvas.tsx` — `onCanvasTouchStartForEdit`: now calls **both** `ta.focus()` AND `startEditingStrokeRef.current(stroke, wp)` on the confirmed double-tap. This moves the entire "enter editing" action into the native user-activation window, so React's later synthetic event finds `isWritingRef = true` and only handles cursor placement — eliminating the double-focus cycle.

2. `Canvas.tsx` — added **`startEditingStrokeRef`** (mirrors `startWritingRef` pattern) so the native handler can call `startEditingStroke` directly.

3. `Canvas.tsx` — textarea `onPointerDown`: changed from `isTouchDevice && touchTool === "text"` to `isTouchDevice` (always register on iOS). This means once `pointer-events: auto` is set during editing, taps on the textarea correctly route to `handlePointerDownForText` for cursor placement.

4. `useTextSelection.ts` — **pointer-events management**: when writing starts (`startWriting`/`startEditingStroke`), set `ta.style.pointerEvents = "auto"` directly via DOM so iOS keeps keyboard focus (textarea becomes tap target → iOS doesn't auto-blur). When writing ends (`finishWriting`), restore to `"none"` (when not in text-tool mode, where React's style prop manages it).

5. `useTextSelection.ts` — **outside-bbox touch commit**: changed `if (e.pointerType === "touch") return;` to commit the text (`finishWriting()`) when `editStroke` is set (editing an existing stroke). New-text sessions (no `editStroke`) still require Done button only.

**Status**: Deployed for testing.

---

## Root causes summary

| Problem | Root cause |
|---|---|
| Keyboard doesn't open | `ta.focus()` not in direct gesture handler (called via `window.dispatchEvent`) |
| Keyboard doesn't open | `opacity: 0` on textarea — iOS rejects focus |
| Keyboard opens then closes | `finishWriting()` called by outside-bbox pointer event (wasn't guarded for `editStroke` sessions) |
| Keyboard opens on single tap | `onCanvasTouchStartForEdit` used stale `lastTextTapRef` without checking `selectedTextRef` |
| Desktop double-click broken | `onBlur` fired during double-click and called `finishWriting()` immediately |

---

## Current architecture (as of Attempt 10)

### How keyboard opens

**Text-tool mode**:
1. Full-screen `opacity:0.01` textarea overlay is the touch target
2. Native `onTouchStartForText` on textarea fires → `ta.focus()` + `startWriting()`
3. `onWriting` (from `drawtool:writing` event) skips `ta.focus()` on iOS — it's already done

**Select-mode double-tap**:
1. First tap → React `onPointerDown` → sets `lastTextTapRef = { stroke, time }` + `selectedTextRef = stroke`
2. Second tap within 300ms → native `onCanvasTouchStartForEdit` fires: checks `last.stroke === selectedTextRef.current` → calls `ta.focus()`
3. Then React `onPointerDown` fires → double-tap detected → `ta.focus()` again (line 717) + `startEditingStroke`

### How keyboard closes (commit text)

- Done button → `visualViewport` height grows >150px after 1500ms startup guard → `finishWriting()`
- Tool switch → `drawtool:toolchange` event → `finishWriting()`
- Desktop: outside-bbox pointer event OR `onBlur` (250ms guard)

---

## What tldraw / excalidraw do

Both apps call `focus()` **directly inside the pointer event handler**, not through custom event dispatch. They do NOT use a full-screen overlay. They position a visible (or lightly styled) textarea at the cursor location and call `focus()` in the click/tap handler. The keyboard opens because the focus call is a genuine direct user-gesture response.

---

## Further plans if Attempt 10 still fails

### Plan A — Native touchstart on canvas for double-tap startEditingStroke

Instead of pre-focusing and relying on React's synthetic event to call `startEditingStroke`, move the entire double-tap detection into the native canvas `touchstart` handler:

```javascript
const onCanvasTouchStartForEdit = (e: TouchEvent) => {
  if (touchToolRef.current === "text" || isWritingRef.current) return;
  const touch = e.touches[0];
  if (!touch) return;
  const wp = screenToWorld(touch.clientX, touch.clientY, viewRef.current);
  const selected = selectedTextRef.current;
  if (!selected?.text) return;
  const bb = anyStrokeBBox(selected);
  const pad = 8 / viewRef.current.scale;
  const inBbox = wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad && wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad;
  if (!inBbox) return;
  const last = lastTextTapRef.current;
  const now = performance.now();
  if (last && last.stroke === selected && now - last.time < 300) {
    ta.focus(); // guaranteed gesture context
    startEditingStrokeRef.current(selected, wp);
    lastTextTapRef.current = null;
  } else {
    lastTextTapRef.current = { time: now, stroke: selected, count: 1 };
  }
};
```

This moves ALL double-tap logic to the native handler, removing dependence on React's synthetic event chain entirely.

### Plan B — Synchronous focus before any dispatch

Ensure `ta.focus()` is the FIRST thing called after any touch gesture that should open the keyboard, before ANY other code runs (no conditions, no refs checked first).

### Plan C — Native textarea touchstart for all modes

Make the textarea full-screen (not just in text-tool mode) with `pointerEvents: "none"` except when writing is active, and use a single native `touchstart` that hits both text-tool and select-mode flows. Avoids the canvas-element native listener entirely.

### Plan D — Debug on device with Safari Web Inspector

Connect iPhone to Mac → Safari → Develop → [device] → enable console logging. Add `console.log` at every `ta.focus()` call, every `finishWriting()` call, and every `visualViewport` resize event. The exact sequence of calls will reveal which path is still calling `finishWriting()` too early.

This is the highest-confidence path to finding the remaining bug if Attempt 10 still doesn't work.
