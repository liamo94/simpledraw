# Drawtool Session Summary — 2026-05-26

## What was shipped

| Fix | What changed |
|---|---|
| Cached workspace/canvas names | Read from localStorage on init → no name jump after refresh |
| Canvas slot number timing | Removed `activeCanvasMeta` gate → slot renders immediately from `activeCanvas` state |
| Top-left button visibility | `isSignedIn !== false` → shows while Clerk is still resolving |
| Double-refresh stroke loss | `skipHook` param on `saveStrokes` + `keepalive` flush on `beforeunload` |
| Default canvas name | `createCanvas('')` instead of `"Canvas N"` |
| Import to correct slot | `cloudActiveIdRef` near top of component → `processImportFile` targets slot 1 in cloud mode |
| Pan-to-fit on import | `drawtool:center-view` dispatched after `drawtool:import-strokes` |
| Black/white inversion | `savedDark` stored with every save; `swapStrokeColors` applied on load when theme differs |
| React Query refactor | `useQuery`/`useMutation` for all API calls in `useCloudCanvas`, `useUserPlan`, `useMigration` |

## Architecture

- Cloud canvases always land in localStorage slot 1 (`CLOUD_SLOT`)
- React Query manages workspaces + canvas data with `staleTime: Infinity`, no background refetch
- Save is manual (debounced 2s PUT) — query cache never triggers cloud writes
- `savedDark` on every canvas payload enables correct color display across theme switches
- `isSignedIn !== false` pattern used (not `=== true`) so cloud UI shows while Clerk resolves
- `saveStrokes(strokes, slot, skipHook=true)` used when loading from cloud to avoid cancelling pending user saves

## Key files

- `src/hooks/useCloudCanvas.ts` — workspace/canvas state, fetch, save, mutations
- `src/hooks/useUserPlan.ts` — Stripe plan status via React Query
- `src/hooks/useMigration.ts` — one-time local→cloud migration
- `src/canvas/storage.ts` — `saveStrokes` with `skipHook` param, `setSaveHook`
- `src/App.tsx` — `cloudActiveIdRef`, `processImportFile`, top-left button condition
- `drawzilla-backend/src/types.ts` — `savedDark?: boolean` on `CanvasData`

## Nothing pending
