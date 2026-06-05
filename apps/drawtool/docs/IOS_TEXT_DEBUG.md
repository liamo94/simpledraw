# iOS Mobile Text Input — Debug Log

## Goal
Enable text entry on iOS: tap text tool → tap canvas → keyboard opens → type → press Done → text committed.

## Architecture
- A hidden `<textarea>` (the "input sink") lives outside the canvas. It captures all keyboard input.
- The canvas renders text visually using refs. The textarea is invisible; only its events matter.
- Writing mode is tracked by `isWritingRef.current`. `onInput` on the textarea reads `ta.value` and updates `writingTextRef`, then redraws.
- Keyboard commit: `finishWriting()` saves the stroke. It dispatches `drawtool:writing` (detail:false), which triggers `ta.blur()`.
- iOS constraint: `ta.focus()` only opens the soft keyboard if called as a **direct result of a user gesture** (pointer/touch event). Async calls (setTimeout, promises) do not open the keyboard.

---

## What broke
Commit `372e358` ("text on mobile") added:
1. A full-screen transparent textarea overlay when `touchTool === "text"` — so the user's tap lands on the textarea, letting the browser auto-focus it.
2. An `onBlur` handler: `if (isWritingRef.current) finishWriting()` — to detect "Done" button press.

This broke desktop double-click editing because `onBlur` fired during the double-click sequence and immediately ended writing.

---

## Fixes attempted

### Fix 1 — 250ms `onBlur` guard
`if (Date.now() - writingStartTime < 250) return;` before calling `finishWriting` in `onBlur`.

**Theory:** The spurious blur from desktop double-click fires within ~100ms. A 250ms guard filters it.

**Result:** Desktop fixed. iOS keyboard opens, but **editing doesn't work** — text typed by the user doesn't appear on canvas. `finishWriting` is likely being called at >250ms due to another iOS blur, setting `isWritingRef = false` before the user types, so `onInput` returns early.

---

### Fix 2 — Touch guard in `handlePointerDownForText`
Added `if (e.pointerType === "touch" && !editStroke) return` before the `finishWriting()` call, to prevent a second tap from ending a new-text session.

**Theory:** A second tap on the full-screen overlay while writing was calling `finishWriting()`.

**Result:** Same issue.

---

### Fix 3 — Skip `ta.focus()` for iOS text-tool tap
In `onWriting`, skip the `ta.setSelectionRange` + `ta.focus()` call when `isTouchDevice && touchToolRef.current === "text"`.

**Theory:** The browser auto-focuses the textarea (since it's the tap target). Calling `ta.focus()` on top of that creates a double-focus cycle → brief blur → keyboard flash.

**Result:** Same issue. (Later applied and reverted multiple times.)

---

### Fix 4 — Disable `onBlur` entirely for touch + `visualViewport.resize`
- `onBlur`: return immediately when `isTouchDevice`.
- Add `window.visualViewport.addEventListener("resize", ...)`: when viewport height **grows** by >150px while writing, call `finishWriting()` (keyboard dismissed = Done pressed).
- Restored `ta.focus()` call (reverted Fix 3).

**Theory:** iOS fires spurious blurs at unpredictable times (not just within 250ms). Skip blur entirely on touch. Use viewport-grow as the reliable "Done" signal.

**Result:** **Worse.** "Keyboard briefly splashes and edit goes off." The `visualViewport` listener was itself being triggered by the brief keyboard-close from the double-focus cycle (browser auto-focus + our `ta.focus()` both happening).

---

### Fix 5 — visualViewport + 500ms startup guard + re-apply Fix 3 + extend pen guard
- Re-applied Fix 3 (skip `ta.focus()` for iOS text-tool mode, to avoid double-focus).
- Added `Date.now() - writingStartTime > 500` guard to `onVVResize` (ignore brief viewport changes in first 500ms).
- Extended Fix 2 guard to also cover Apple Pencil (`e.pointerType === "pen"`) in text-tool mode.

**Theory:** Fix 3 avoids the double-focus that was triggering the visualViewport listener. The 500ms guard is a safety net.

**Result:** **Keyboard doesn't open at all.** Removing `ta.focus()` means the browser's auto-focus is the only mechanism — and it appears not to be reliable enough (or not happening at all).

---

## Key unknowns / open questions

1. **Does the browser actually auto-focus a `tabIndex={-1}` full-screen textarea on iOS?** We assumed yes but never confirmed. If not, `ta.focus()` is required and Fix 3 is wrong.

2. **Does calling `ta.focus()` inside `onWriting` (fired via `window.dispatchEvent`) actually open the iOS keyboard?** iOS requires `focus()` to be called as a *direct* result of a user gesture. `window.dispatchEvent(new CustomEvent(...))` creates a new event — the handler for it may NOT inherit user activation, breaking the gesture chain.

3. **Why does the spurious blur fire at >250ms on iOS?** The double-focus cycle (browser auto-focus + explicit `ta.focus()`) causes a brief blur. But the timing seems to vary widely across iOS versions/devices, making time-based guards unreliable.

---

## What tldraw / excalidraw do differently

Both apps call `focus()` **directly inside the pointer event handler**, not through a custom event dispatch chain. They do NOT use a full-screen overlay. They position a visible (or lightly styled) textarea at the text cursor location and call `focus()` on it in the click/tap handler. The keyboard opens because the focus call is a genuine direct user-gesture response.

---

## Next approach to try

Call `ta.focus()` **directly in `handlePointerDownForText`** — before calling `startWriting` — so the focus happens while we're provably inside the pointer event handler (user gesture context). Then skip `ta.focus()` in `onWriting` for iOS (to avoid double-focus). Combined with:
- `onBlur` skip for touch
- `visualViewport` with 500ms startup guard

This mirrors what tldraw/excalidraw do: focus is a direct gesture response, not mediated through a custom event.
