# OCS Work Order Platform

Operational work-order platform for OCS dispatchers and field engineers.
Built on TanStack Start (React 19, Vite 7) with Lovable Cloud (Supabase)
as the backend.

## Modules

- Auth + role-based routing (dispatcher / engineer)
- Dispatcher dashboard, intake / attention / dispatch / review queues
- Work-order schema, assignments, field-lock enforcement
- Engineer directory and availability
- Engineer mobile workflow (offline-first queue + sync engine)
- Evidence capture and expenses
- Google Sheets planner sync (server-only, push + pull + conflict detection)
- Contact directory + 1:1 direct messaging
- Telegram account linking + server-side notification bridge

## Architecture

- **Frontend**: React 19 + TanStack Router (file-based routes under `src/routes/`)
- **Server**: TanStack `createServerFn` for app-internal logic
  (`src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/services/*.server.ts`)
- **Database**: Supabase (Postgres + RLS), accessed via three clients:
  - `@/integrations/supabase/client` — browser, publishable key, RLS as user
  - `@/integrations/supabase/auth-middleware` — server fn middleware, RLS as user
  - `@/integrations/supabase/client.server` — service role, server-only (never imported from client)
- **Storage buckets**: `work-order-source-docs`, `work-order-evidence`,
  `work-order-signatures`, `work-order-receipts`, `direct-message-attachments`

## Required environment variables

See [`.env.example`](./.env.example). All values are managed by Lovable Cloud
and injected at runtime; you do not need to populate `.env` manually.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | Browser | Supabase client |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Server | Auth-scoped server fns |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Admin operations (bypasses RLS) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Server-only | Planner sync auth |
| `PLANNER_SPREADSHEET_ID` / `PLANNER_SHEET_NAME` | Server-only | Planner sync target |
| `TELEGRAM_API_KEY` | Server-only | Telegram bot bridge |
| `LOVABLE_API_KEY` | Server-only | Lovable AI Gateway |

## Backend setup expectations

### Supabase (Lovable Cloud)
- All app tables enable RLS; dispatcher-vs-engineer access is enforced via
  `has_role()`, `engineer_is_assigned()`, `engineer_is_lead()`, and
  `is_thread_participant()` security-definer helpers.
- Roles are stored in `public.user_roles` (never on `profiles`).
- New users get a profile + default `engineer` role via the
  `handle_new_user()` trigger on `auth.users`.
- A `seed_demo_data()` SQL function (dispatcher-only) loads/refreshes the
  demo client, engineer, and work-order set used by the dispatcher UI.

### Google Sheets planner
- Share the target spreadsheet with the service account email from
  `GOOGLE_SERVICE_ACCOUNT_JSON` (Editor access).
- Set `PLANNER_SPREADSHEET_ID` to the sheet ID and `PLANNER_SHEET_NAME` to
  the planner tab. The sync runs only from `src/lib/plannerSync.server.ts`
  and `src/services/googleSheetsSync.server.ts` — never from the browser.

### Telegram bridge
- Connected via the Lovable Telegram connector (`TELEGRAM_API_KEY`).
- Each user opts in by linking their Telegram chat from the Contacts page
  (writes `user_contact_profiles.telegram_chat_id`).
- Outbound notifications are sent only from
  `src/services/telegramSend.server.ts`; delivery is logged in
  `telegram_notification_log`.

## Local development

```bash
bun install
bun dev
```

The dev server is managed by Lovable; builds and type-checks run
automatically on every change.

## Deployment

Use the in-app **Publish** flow. Lovable Cloud rotates the publishable +
service role keys and deploys the TanStack app to Cloudflare Workers
(edge runtime, `nodejs_compat`).

## Secret hygiene

- `.env` and `.env.*` are gitignored; only `.env.example` is committed and
  contains placeholder values. Real values are injected by Lovable Cloud
  at runtime and never need to be edited locally.
- Browser-safe variables use the `VITE_` prefix (Supabase URL, publishable
  key, project ID) and are bundled into the client build. Everything else
  (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
  `PLANNER_SPREADSHEET_ID`, `PLANNER_SHEET_NAME`, `TELEGRAM_API_KEY`,
  `LOVABLE_API_KEY`) is **server-only** and is read exclusively from
  `process.env` inside `*.server.ts` modules or `createServerFn` handlers.
- The service-role admin client lives in
  `src/integrations/supabase/client.server.ts` and must only be imported
  from `*.server.ts` / `*.functions.ts` files. The `.server.ts` extension
  makes the bundler refuse any client-side import.
- If a real secret was ever committed to this repo before this hygiene
  pass, treat it as compromised: **rotate the affected credential
  (Supabase service role, Telegram bot token, Google service account)
  and purge it from Git history outside the app** (e.g. via
  `git filter-repo` on a local clone). Lovable cannot rewrite Git
  history from inside the project.

## Demo data

A dispatcher can run `select public.seed_demo_data();` from the Cloud SQL
console to wipe and reload the OCS-DEMO-* fixture set (clients, engineers,
availability, work orders, assignments, parsing reviews, events).

## Launch readiness

Use this checklist before promoting a build to live customers. Each item
can be re-verified at any time without code changes.

### Roles & access (RLS)
- `user_roles` is the source of truth — never trust a role on `profiles`
  alone. Promote an account by inserting `('dispatcher', user_id)`.
- Dispatcher-only tables (`billing_*`, `parsing_*`, `intake_records`,
  `engineer_availability`, `external_contacts`, `communication_*`,
  `recommendations`, `sheet_sync_log`) gate ALL operations through
  `has_role(auth.uid(),'dispatcher')`.
- Engineer reads on `work_orders`, `work_order_files`, `work_order_events`,
  `work_order_expenses`, `work_order_external_contacts`, `clients`, and
  `recommendations` are scoped via `engineer_is_assigned()`. Writes that
  mutate the field record (events, files, expenses, status changes) are
  scoped to `engineer_is_lead()` and additionally guarded by the
  `guard_active_field_lock` trigger.
- `notifications` and `notification_preferences` are owner-scoped
  (`recipient_profile_id = auth.uid()`); creation is system-only via
  `create_notification` triggers.
- `direct_messages` / `direct_message_files` / `direct_message_participants`
  use `is_thread_participant()` so only thread members can read or send.

### Critical journeys to smoke-test
1. **Intake → work order**: ingest, parsing review, convert to WO,
   confirm `parsing_reviews` resolves and the WO appears in dispatch.
2. **Assignment**: open `AssignEngineersDialog`, confirm the
   recommendation panel ranks candidates, assign lead + support.
3. **Diary / reschedule**: drag from Unscheduled to an engineer-day,
   confirm capacity & conflict badges update and a `diary_changed`
   notification fires.
4. **Engineer mobile**: install PWA, accept job, capture photo +
   receipt + signature offline, reconnect → MobileSyncBanner clears
   and the items appear in `work_order_files` / `work_order_expenses`.
5. **Planner sync**: push a WO, edit in the sheet, pull back, force
   a conflict (edit both sides) and confirm `planner_conflict_flag`
   surfaces in the dispatch board.
6. **Billing prep**: open a completed WO's billing case, run the
   readiness checklist, transition to `ready_for_invoice` and
   confirm a `billing_ready` notification reaches dispatchers.
7. **External communications**: log an inbound call, mark
   follow-up due, resolve, confirm the follow-up queue clears.
8. **Telegram**: link a chat ID on `user_contact_profiles`, trigger
   any event that calls `notify_dispatchers`, run
   `flushTelegramNotifications` and verify
   `notifications.telegram_delivery_status` advances to `sent`.

### Deployment checks
- **Client/server boundary**: nothing under `src/components`,
  `src/hooks`, `src/routes` imports
  `@/integrations/supabase/client.server` or any `*.server.ts` file —
  the bundler will fail the build if this regresses.
- **Env**: every server-only secret listed above must exist in the
  Lovable Cloud secrets panel for the target environment. Browser keys
  are auto-populated from `.env`.
- **PWA**: `public/manifest.json`, `icon-192.png`, `icon-512.png`, and
  the PWA meta tags in `src/routes/__root.tsx` must all be present for
  iOS "Add to Home Screen" and Android install prompts.
- **DB linter**: the only outstanding warnings are advisory
  `SECURITY DEFINER` notes on `has_role`, `engineer_is_*`,
  `is_thread_participant`, `create_notification`, and the trigger
  functions. These are required to avoid RLS recursion and are scoped
  by `SET search_path = public`; do not "fix" by switching to
  `SECURITY INVOKER`.
- **Auth providers**: confirm Google is enabled in Cloud → Auth, and
  that email confirmations are toggled to match the launch policy.

### Operator runbooks
- **Promote a user to dispatcher**: `insert into public.user_roles
  (user_id, role) values ('<uuid>', 'dispatcher');`
- **Re-seed demo data**: `select public.seed_demo_data();` (dispatcher
  session required).
- **Force Telegram flush**: call the `flushTelegramNotifications`
  server fn from a dispatcher session (used by cron or admin tools).
- **Recover stuck field-lock**: a dispatcher can clear
  `work_orders.field_lock_active` after confirming the engineer is
  offline; the guard trigger blocks status edits while the lock is
  active.