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