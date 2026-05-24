# HANDOFF.md — Vela App

Canonical context document for new Claude / Claude Code sessions on this project.
Update this file at the end of every session before committing.

---

## Project Overview

**Vela** is a progressive web app for overlanding expeditions in the Pacific Northwest,
built around a 2014 Jeep JKU with Ursa Minor V2 camper ("Chomp"). Primary users are
Dan + Emily (single household today). Multi-tenant architecture is built in for a future
community rollout — every user-data table has `user_id` + RLS.

Three repos, three subdomains:

| Repo | URL | Purpose |
|------|-----|---------|
| `vela-app` | app.vela-go.com | Main PWA — trips, gear, rig telemetry, AI features |
| `vela-admin` | admin.vela-go.com | Internal admin — user management, bug triage, feature flags |
| `vela-landing` | vela-go.com | Marketing landing page |

---

## Stack Details

| Layer | Tech |
|-------|------|
| Framework | React 19, Vite 8 |
| Styling | Tailwind 4, CSS custom properties (`var(--token)`) |
| Maps | MapLibre GL JS + react-map-gl; tiles via OpenFreeMap (no API key) |
| Auth | Supabase Auth with Google OAuth — **NOT Firebase** |
| Offline DB | IndexedDB via `idb@8` |
| Sync DB | Supabase Postgres |
| UUIDs | Client-generated via `uuidv4()` before insert |
| Deployment | GitHub Pages + Cloudflare (proxied, SSL Full). `npm run deploy` for vela-app and vela-admin. vela-landing auto-deploys from main. |

**DB conventions:** snake_case tables/columns, `timestamptz`, RLS on every user-data table.

**Themes:** `slate` (default), `parchment`, `evergreen` — applied via `[data-theme]` CSS
selectors. Accent color: `#f97316` (orange), exposed as `var(--accent)`.

**Dev debug:** `window.supabase = supabase` exposed in dev via `import.meta.env.DEV` guard.

**DevRibbon:** folded-corner indicator showing `__ENV_LABEL__` + `__APP_VERSION__` +
`__BUILD_DATE__`, gated on `VITE_ENV_LABEL`. Both apps run identical `DevRibbon.jsx`
implementations — diverging them is a smell.

---

## Supabase Schema (key tables)

All user-data tables are RLS-protected with `user_id` FK and policies:
"users manage own X" + "admins manage all X".

**User data:**

| Table | Purpose |
|-------|---------|
| `trips` | Trip records with status, dates, region, waypoints, campsites |
| `gear_items` | Gear registry items with category, brand, weight |
| `crew_members` | Crew invites/members per trip |
| `trip_positions` | Live GPS broadcast rows (Realtime DELETE signals watch page) |
| `tracks` | GPX/KML/GeoJSON track records with GeoJSON geometry |
| `vehicles` | Fleet vehicles with integrations JSON, maintenance log |
| `pets` | Pet profiles attached to user |
| `glove_box` | Travel document storage (linked to trips or standalone) |
| `crews` | Named crew groups |
| `knowledge_docs` | RAG knowledge base documents (chunked, embedded) |
| `user_secrets` | Encrypted HA token (`ha_token_encrypted`), one row per user |

**Admin / role tables:**

| Table | Purpose |
|-------|---------|
| `admin_users` | Grants admin access to vela-admin |
| `tester_users` | Grants tester role; checked via `is_tester()` RPC |
| `bug_reports` | User-submitted bug reports with screenshots |
| `error_logs` | ErrorBoundary telemetry — component stack, user_id, url |
| `feature_flags` | Row per flag (`id` text PK, `enabled` bool). Read by any authed user. |

---

## vela-app Key Files

| File | What it does |
|------|-------------|
| `src/store/index.jsx` | Global `AppContext` — trips, user, profile, isPro, flags (feature_flags), weather, AQI, EcoFlow SOC, GPS, theme/accent, pending invite count, pets/tripLabels prefs |
| `src/store/rigStatus.jsx` | Lightweight `RigStatusContext` scoped inside `RigPage`. Tracks `power`, `comms`, `env` status strings (`'connected'`, `'offline'`, `'unconfigured'`) for the three StatusPills. Written by section components via `useSetRigStatus`. |
| `src/store/haTokenStore.jsx` | `HaTokenProvider` + `useHaToken`. Loads encrypted HA token from `user_secrets`, decrypts in-memory (auto-mode: `user.id` + `APP_SECRET`; passphrase-mode: user-entered). Exposes `plaintextToken`, `status`, `unlock`, `setToken`, `changeMode`, `clear`, `forgetOnDevice`, `requestUnlock`. |
| `src/lib/supabase.js` | Configured Supabase client. `window.supabase` assigned in dev. |
| `src/lib/crypto.js` | PBKDF2-SHA256 (600k iterations) + AES-GCM token encryption. Two modes: `passphrase` (user holds key) and `auto` (user.id + APP\_SECRET). APP\_SECRET is a fixed string — security-through-obscurity for auto-mode only. |
| `src/utils/pendingSync.js` | `getLastSyncTime`, `setLastSyncTime`, `countPending` (aggregates IDB flags + localStorage queues), `listPending`, `subscribeToCount`, `emitSyncChanged`. Source of truth for the sync badge count. |
| `src/utils/gearStorage.js` | IDB v2, `getGearDB`. `saveGearItem` sets `pending_sync: true`; `saveGearItemLocal` sets `pending_sync: false` (for server-pull, no network call). `clearGearItemPendingSync(id)` clears per-item on confirmed sync. `emitSyncChanged` dispatches `vela:sync-changed`. |
| `src/utils/trackStorage.js` | Same pattern as gearStorage for tracks. `getTracksDB`, v2. |
| `src/utils/syncManager.js` | Thin Supabase wrappers: `syncTripToSupabase`, `fetchTripsFromSupabase`, `deleteTripFromSupabase`, `syncGearToSupabase`, `fetchGearFromSupabase`, `deleteGearFromSupabase`, `syncTrackToSupabase`, `fetchTracksFromSupabase`, `deleteTrackFromSupabase`. Also exports the now-dead `bulkSyncGearToSupabase` — see Deferred. |
| `src/utils/trackParser.js` | GPX/KML/GeoJSON → GeoJSON FeatureCollection. Uses `@tmcw/togeojson` + Turf simplify with degenerate geometry guards and setTimeout yield for large files. |
| `src/hooks/usePendingSync.js` | `usePendingSyncCount()` — useState + event listener on `vela:sync-changed`. |
| `src/hooks/useTracks.js` | Track CRUD with IDB-first, Supabase sync, file upload to Storage, simplification. `importTrack` is the main entry point. |
| `src/hooks/useCommunications.js` | GL-iNet router state via HA entity polling. Uses `plaintextToken` from `useHaToken`. |
| `src/hooks/useHomeAssistant.js` | Full HA entity fetch — temp sensors, humidity, lights, scenes, battery sensors, system stats. Authenticated via `plaintextToken`. Triggers `requestUnlock` if token locked. |
| `src/hooks/useEcoFlow.js` | EcoFlow MQTT telemetry hook. Returns `soc`, `totalInputWatts`, `totalOutputWatts`, `cycles`, `lastUpdated`. |
| `src/hooks/useIsTester.js` | Checks `tester_users` table. Returns `{ isTester, loading }`. |
| `src/components/CollapsingHeader.jsx` | Slot-based collapsing header used by Home, Rig, Safety, More pages. Props: `image`, `title`, `subtitle`, `badge`, `gps`, `scrollProgress`, `onOpenSettings`, children (tab chips slot). GPS dot uses `var(--status-connected)` / `var(--status-warning)` / `var(--status-offline)`. |
| `src/components/StatusPill.jsx` | Rig tab chip with three-state dot (connected/offline/unconfigured). Props: `status`, `label`, `isActive`, `onClick`, `accent`. |
| `src/components/TripTypeIcons.jsx` | SVG icon map for trip types (Overlanding, Camping, Hiking, etc.). |
| `src/components/BugReportButton.jsx` | Fixed-position bug button. Tester-only (gated on `useIsTester`). 50% opacity, true corner position. |
| `src/components/BugReportModal.jsx` | Bug report form with html2canvas screenshot, priority, category, Supabase insert + Storage upload. |
| `src/components/DevRibbon.jsx` | Folded-corner ribbon. Reads `__ENV_LABEL__`, `__APP_VERSION__`, `__BUILD_DATE__` from Vite defines. |
| `src/components/ErrorBoundary.jsx` | Class component. On `componentDidCatch`: writes `component_stack`, `error_message`, `user_id`, `url` to `error_logs` table. |
| `src/components/HaTokenSetupModal.jsx` | First-time HA token setup — mode picker (passphrase / auto), token input, calls `setToken`. No longer handles localStorage migration (removed Phase 2h). |
| `src/components/HaUnlockModal.jsx` | Passphrase prompt shown when `unlockRequested` is true. |
| `src/components/PendingSyncIndicator.jsx` | Fixed-position pill, bottom-right above nav. Shows unsynced count badge. Dispatches `vela:open-sync-panel`. Returns null when count = 0. |
| `src/components/PendingSyncPanel.jsx` | Bottom sheet. Lists pending items by type. Retry calls `onRetry()` (which calls `runLoginSync`). Reads `{ succeeded, failed, offline, unexpected }` from result for truthful toast messages. |

---

## vela-admin Surfaces

| Route | Purpose |
|-------|---------|
| `/login` | Sign-in page. Redirects to `/` if session already exists. |
| `/users` | Admin + tester toggles per user row. |
| `/content` | CRUD on trips, gear, crew members, tracks. |
| `/bugs` | Bug reports with status/priority filters, signed-URL screenshot viewer. |
| `/system` | DB row counts, `error_logs` viewer, `feature_flags` toggles. |
| `/tools` | Bbox backfill, vacuum, export, impersonate. |

---

## Local Dev

```
vela-app:   http://localhost:5173  (strictPort)
vela-admin: http://localhost:5174  (strictPort)
```

- Override port: `npm run dev -- --port NNNN` — add the new origin to Supabase OAuth
  redirect allowlist before testing auth.
- `.env.local`: set `VITE_ENV_LABEL=DEV` to show the DevRibbon.
- `VITE_ENV_LABEL` must **not** be set in `.env.production` or GitHub Pages builds.
- Both apps point at the **same Supabase project** — dev = prod data. Be careful with
  destructive operations.

---

## Cloudflare DNS

All three subdomains: `CNAME → danbrown1010.github.io`, proxied, SSL Full.

To add a new subdomain: Cloudflare Dashboard → vela-go.com → DNS → Add CNAME record,
enable proxy. SSL provisioning takes a few minutes.

---

## Supabase OAuth Redirect URLs

Must be in the allowlist (Supabase Dashboard → Auth → URL Configuration):

```
http://localhost:5173/**
http://localhost:5174/**
https://app.vela-go.com/**
https://admin.vela-go.com/**
```

---

## Shipped (current session)

- **Rig page three-state status pills** — Power / Comms / Environment chips with shared
  `rigStatus` store (`src/store/rigStatus.jsx`). Each integration section reports its
  status via `useSetRigStatus`; pills read via `useRigStatus`. 10s poll, 25s freshness
  window for EcoFlow connected/offline determination.
- **Client-encrypted HA token** — `user_secrets.ha_token_encrypted` stores a JSON
  envelope (`{ mode, iv, salt, ciphertext }`). Two modes: `passphrase` (PBKDF2 + AES-GCM,
  user holds the key) and `auto` (same cipher, key derived from `user.id` + `APP_SECRET`).
  `HaTokenProvider` auto-decrypts on load in auto-mode; triggers `HaUnlockModal` in
  passphrase-mode when a hook calls `requestUnlock`.
- **Bug button polish** — smaller, 50% opacity, true corner position.
- **Sheet z-index portal fix** — doc preview modal renders above bottom nav via
  `createPortal(…, document.body)`.
- **Google sign-in button** — style matched across vela-app and vela-admin.
- **Phase 2 cleanup (2a–2h)** — see commit log for full detail. Summary:
  - 2a: Dead code + CSS variable normalization (21 files, −90/+65)
  - 2b: `ErrorBoundary` → `error_logs` telemetry (both repos)
  - 2c: Toast on Supabase mutation + auth errors (both repos)
  - 2c.5: Pending-sync indicator — count badge, bottom-sheet panel, manual retry,
    `runLoginSync` returns `{ succeeded, failed, offline, unexpected }`
  - 2c.5.1: Fix silent success on offline/failed writes (per-item sync, `navigator.onLine`
    guard, conditional `setLastSyncTime`)
  - 2d: Hardcoded hex status/semantic colors → CSS tokens across 10 files
  - 2e: `feature_flags` loaded from Supabase at startup via `store/index.jsx`
  - 2f: RigPage dead code removal (−369 lines: 9 dead components + constants + handlers)
  - 2g: Debug `console.log` removal (7 statements across 3 files)
  - 2h: localStorage HA token migration path removed (`migrationToken`, `migrationDismissed`,
    `isMigration` branch)
- **HANDOFF.md** — created and committed.

---

## Shipped (prior sessions)

- Track import (GPX/KML/GeoJSON parse + Turf simplify + IDB-first with Supabase sync);
  paused at Phase 4 polish
- DevRibbon (both apps), v0.1.0
- Auth gate refactor (vela-admin): `noSession` vs `denied` states; `LoginPage` split from
  `AuthGate`
- Tester role: `tester_users` table, `is_tester()` RPC, `useIsTester` hook
- Bug reporting: vela-app button + modal + screenshot capture; vela-admin `/bugs` review
  surface
- Polish session: Power / Comms / Environment tabs, `CollapsingHeader`, trip types
- VELA design system + lockups across vela-app and vela-landing
- vela-admin full 5-phase build (auth, users, content, bugs, system/tools)
- Rotating hero backgrounds on `AuthPage` and vela-landing

---

## Paused / Incomplete

- **Track import (vela-app)** — functional but rough. Simplify on large GPX (7k+ points)
  blocks the JS thread; mitigated with `setTimeout` yield, not a Web Worker. Phase 4
  polish not started: no waypoint popups, no fit-to-bounds refinement on import, no track
  deletion confirmation.

---

## Deferred

Explicit decisions — **do not pick up without re-evaluating the tradeoff.**

| Item | Reason deferred |
|------|----------------|
| Background GPS tracking | iOS PWA can't do true background GPS. Decision: GPX import only. Future path: Capacitor wrapper if priority changes. |
| Starlink dish telemetry | UX cost of cloud cookie auth too high; no first-party consumer API. |
| Slate AX uplink detection | Security tradeoff of exposing router RPC unacceptable. |
| OBD-II via Veepeak BLE | No mature HA-native generic ELM327. Path: fork `pbutterworth/nissan-leaf-obd-ble` or buy OBDLink CX/MX+ WiFi adapter. |
| `pendingSync.js` unused imports | `getPendingSaves` and `getPendingTrackSaves` imported but never referenced (`no-unused-vars`). One-line fix each; do alongside future pendingSync work. |
| Unified IDB queue refactor | Five separate queues today (gear IDB flag, gear localStorage deletes, track IDB flag, track localStorage deletes, trip localStorage saves/deletes). Consolidate to a single typed operation queue in IDB. Own session. |
| Residual hardcoded hex in RigPage live components | `SensorBatteriesSummary` uses `'#22c55e'` / `'#ef4444'`; `EcoflowCompactRow` uses `'#ef4444'`. Map to `var(--status-connected)` / `var(--status-offline)`. Phase 2d predated 2f; pick up in a future 2d.2. |
| vela-admin Phase 2d–2h | No hex sweep, no lint pass, no dead code audit. 30-min mirror pass if admin surfaces to testers. |
| `useSyncOnLogin` full table scan | Fetches all gear on every login even with no pending writes. Skip fetch if `pending_sync` count is 0 AND last sync was recent. Fine at current scale (~200 items). |
| `bulkSyncGearToSupabase` dead export | Replaced by per-item sync in 2c.5.1. Function still exported from `syncManager.js`. Remove in next cleanup pass. |

---

## Working Style Notes for Future Sessions

- **Tone:** Short, concise answers. Bullet points over numbered lists. Treat Dan as expert
  architect — no hand-holding.
- **Task format:** Pasteable plain-text in fenced code blocks, not file downloads.
- **Phase-gated builds work well** — Discovery → Approval → Build → Verify per phase.
  Large agentic builds drift without checkpoints.
- **Schema:** Always run `SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'X'` before writing migrations. Never assume column existence.
- **OAuth:** Use `window.location.origin` for `redirectTo`, never hardcoded URLs.
- **Mutation errors:** Always toast on Supabase mutation errors — silent failures cost
  a debugging session.
  ```js
  const { error } = await supabase...
  if (error) { showToast(error.message); return }
  ```
- **HMR:** Can leave the module graph broken after auth/session refactors. If something
  hangs or behaves oddly: hard reload (`Cmd+Shift+R`) before deeper diagnostics.
- **Logo sizing:** `height: 28–36px` in nav, `height: 36–44px` in hero. Never
  `width: 100%` override.
- **Environment confirmation:** When a dev/prod discrepancy appears, check the DevRibbon
  first. Both apps share the same Supabase project.
- **Commit hygiene:** Run `git status` at the start of every session before any work.
  Multi-session gaps have repeatedly accumulated uncommitted drift.

---

## Known Stale Patterns to Watch For

If a future session's context mentions any of these, they are **wrong**:

| Wrong | Correct |
|-------|---------|
| "Firebase Auth" | Supabase Auth |
| "Vercel" | GitHub Pages + Cloudflare |
| "chomp-app" / "chomp-docs" | `vela-app` / `vela-landing` |
| "dark mode default" | slate theme default |
| "dark mode" / "light mode" theme names | `evergreen` / `parchment` / `slate` |
| "Resolved" as a bug status | "Fixed" (matches `bug_reports` CHECK constraint) |
| "AuthGate renders SignInPage inline on no-session" | It Navigates to `/login`; inline sign-in only at `/login` |
| "localStorage for HA token" | Encrypted `user_secrets` (Phase 2h). Migration path removed. |
| "bulkSyncGearToSupabase is the sync path" | Per-item sync in `useSyncOnLogin` (Phase 2c.5.1). Bulk function is dead. |

---

## Known Gotchas — Do Not Touch Without Reading

**`navigator.onLine` on iOS Safari behind a captive portal** returns `true` even when
all requests fail. `runLoginSync` handles this correctly because per-item Supabase calls
return `{ error }` rather than throwing — `failed > 0` produces the correct toast. Do not
"strengthen" the guard by throwing early on `!navigator.onLine`; it would break
partial-success accounting.

**`bug_reports.status` CHECK constraint** accepts: `'new'`, `'in_progress'`, `'fixed'`,
`'wont_fix'`, `'duplicate'`. Anything else 400s silently.

**DevRibbon globals** (`__APP_VERSION__`, `__BUILD_DATE__`, `__ENV_LABEL__`) are baked at
build time. `npm run dev` shows the date the dev server was started, not the last commit.

**IDB upgrade callbacks in `idb@8`** support `await` inside `upgrade(db, oldVersion,
newVersion, tx)`. Cursor backfill pattern for schema migrations:
```js
let cursor = await store.openCursor()
while (cursor) {
  await cursor.update({ ...cursor.value, new_field: defaultValue })
  cursor = await cursor.continue()
}
```

**`HaTokenSetupModal` no longer handles migration.** The `prefilledToken` /
`isMigration` path was removed in Phase 2h. The modal is first-time setup only.
