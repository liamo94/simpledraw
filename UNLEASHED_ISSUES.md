# Unleashed — Issue Tracker

---

## Bugs

- [x] **1. Frozen share R2 blobs leak on canvas / workspace deletion**
  `DELETE /canvases/:id` and `DELETE /workspaces/:id` delete `canvases/{id}.json` but not `shares/{token}.json` blobs for any frozen shares on that canvas. D1 rows cascade-delete correctly but R2 blobs are orphaned. The daily cron only cleans *expired* frozen shares, not ones whose parent was manually deleted.
  **Files:** `drawzilla-backend/src/routes/canvases.ts:146–161`, `workspaces.ts:137–154`
  **Fix:** Query frozen share R2 keys before deleting a canvas / workspace, then delete them alongside the canvas blob.

- [x] **2. `POST /canvases/reorder` doesn't enforce same-workspace constraint**
  Ownership check verifies `user_id` but not that all IDs belong to the same workspace. A user with two workspaces can submit a mixed-workspace ID list and silently overwrite positions across both workspaces.
  **File:** `drawzilla-backend/src/routes/canvases.ts:52–64`
  **Fix:** Add a workspace consistency check — after the ownership query, verify all returned canvases share a single `workspace_id`.

- [x] **3. `customer.subscription.updated` doesn't handle non-active statuses**
  Only handles `active` / `trialing`. If Stripe moves a subscription to `past_due` or `unpaid` due to payment failure the event fires, the `isActive` guard fails silently, and the user retains Pro indefinitely through the dunning window (days–weeks before `deleted` fires).
  **File:** `drawzilla-backend/src/routes/webhooks/stripe.ts:53–66`
  **Fix:** Add an `else` branch that sets `plan = 'free'` (or marks status as `past_due` in subscriptions) for non-active statuses.

- [x] **4. `POST /migrate` doesn't subtract existing canvases from the limit**
  `canvases.slice(0, cloudLimit)` uses the plan limit (3 or 9) but ignores canvases already in the workspace. The frontend gates migration on `hasCloudCanvases === false` so this path normally runs against an empty workspace, but a crafted request from a user with existing canvases could bypass the free 3-canvas cap.
  **File:** `drawzilla-backend/src/routes/migrate.ts:40–62`
  **Fix:** Change slice to `canvases.slice(0, Math.max(0, cloudLimit - position))`.

- [x] **5. Cron runs cleanup and backup in parallel — backup can snapshot mid-deletion**
  `Promise.all([cleanupExpiredShares, cleanupExpiredSubscriptions, backupDatabase])` means the daily backup can capture D1 mid-cleanup: subscription rows deleted but `users.plan` not yet updated to free, or blank workspaces not yet re-created. Inconsistent snapshots reduce backup usefulness for recovery.
  **File:** `drawzilla-backend/src/index.ts:50–54`
  **Fix:** Await cleanups first, then run backup: `await Promise.all([cleanupExpiredShares(env), cleanupExpiredSubscriptions(env)]); await backupDatabase(env)`.

---

## Security

- [x] **6. `successUrl` / `cancelUrl` / `returnUrl` not validated server-side**
  These URLs arrive from the request body and are forwarded directly to Stripe. Stripe validates checkout redirect URLs against its dashboard allowlist, but the billing portal `return_url` has no such restriction — any URL is accepted. A compromised or malicious client can direct users to arbitrary domains after checkout.
  **File:** `drawzilla-backend/src/routes/stripe.ts:30, 67`
  **Fix:** Validate that all three URLs start with `https://drawzil.la` or `https://unleash.drawzil.la` before passing to Stripe.

- [x] **7. Dev endpoints guarded by positive `!== 'production'` check**
  `if (c.env.ENVIRONMENT === 'production') return 404` — if `ENVIRONMENT` is unset or misconfigured on a remote deploy, all three dev endpoints (`/dev/cancel`, `/dev/expire`, `/dev/reset`) are silently exposed. `wrangler.toml` has `ENVIRONMENT = "production"` which currently protects it, but defence-in-depth suggests inverting the guard.
  **File:** `drawzilla-backend/src/routes/stripe.ts:89, 106, 121`
  **Fix:** `if (c.env.ENVIRONMENT !== 'development') return c.json({ error: 'Not available' }, 404)`.

---

## Performance

- [x] **8. `requireAuth` middleware writes to D1 on every request**
  `INSERT OR IGNORE INTO users` runs unconditionally on every authenticated API call. For existing users this is a wasted D1 write on every request. It exists as a fallback for missed Clerk webhooks, but fires even when the user row definitely already exists.
  **File:** `drawzilla-backend/src/middleware/auth.ts:19–21`
  **Fix:** Either accept the cost (it's small and correct) or do a `SELECT 1 FROM users WHERE clerk_id = ?` first and only INSERT on miss.

- [x] **9. Export endpoint has no total canvas cap**
  `GET /workspaces/export` does `Promise.all` over all canvases for all workspaces — up to 45 parallel R2 reads for a Pro user with 5 workspaces × 9 canvases in a single Worker invocation. Fine today, approaches limits at scale or with large canvases.
  **File:** `drawzilla-backend/src/routes/workspaces.ts:73`
  **Fix:** Add a total canvas cap (e.g. 50) with a 400 response if exceeded, or stream the response.

- [x] **10. `backup.ts` R2 list doesn't handle pagination**
  `env.STORAGE.list({ prefix: BACKUP_PREFIX })` returns at most 1000 objects per call and doesn't check `truncated`. With 7-day retention there are ≤ 7 backup objects so this is safe today, but fragile if retention policy ever changes.
  **File:** `drawzilla-backend/src/utils/backup.ts:37`
  **Fix:** Loop on `list.truncated` with a cursor to handle paginated results.

- [x] **11. `GET /workspaces` uses `SELECT *` — returns internal fields to all callers**
  `SELECT * FROM workspaces` returns `share_token` for every workspace even when `share_enabled = 0` and the token is never shown in the UI. Not a security issue (the user owns the data) but wasteful, and leaks internal state that could be tightened.
  **File:** `drawzilla-backend/src/routes/workspaces.ts:39`
  **Fix:** Enumerate columns explicitly, or at minimum document it as intentional.

---

## Frontend

- [x] **12. `forkCanvas` in ShareViewer always forks into the user's first workspace**
  `getFirstWorkspace()` fetches `/workspaces` and takes `workspaces[0]`, ignoring the user's currently active workspace. A Pro user with multiple workspaces will silently have forked canvases land in the wrong workspace with no feedback.
  **File:** `blackboard/apps/drawtool/src/components/ShareViewer.tsx:169–178`
  **Fix:** Pass the user's active workspace ID (from `cloudSessionStore`) into the fork flow, falling back to `workspaces[0]` only if unavailable.

---

## Missing vs Plan

- [x] **13. No rate limiting on any API endpoint**
  No per-user or per-IP rate limiting is present. Most sensitive: `POST /canvases/:id/share` (frozen path) — each call copies the full canvas R2 blob to a new `shares/{token}.json`. The 100-active-share cap provides some guard, but 100 rapid requests still create 100 R2 writes and 100 blobs. Low risk at current scale.
  **Fix:** Handled as a deployment step — added a WAF Rate Limiting rule reminder to `wrangler.toml` pre-production checklist. Configure in Cloudflare dashboard: 20 req/min per IP on `POST /canvases/*/share`.

- [ ] **14. Transactional email on cancellation not implemented** *(deferred to pre-prod)*
  UNLEASHED.md lists this as a nice-to-have: send a "your data will be deleted on {date}" email when a subscription enters `cancelling` state. Currently users only see the in-app cancellation banner.
  **Options:** Resend (3k/mo free tier) or Cloudflare Email Workers + MailChannels (free, requires SPF/DKIM DNS setup).
