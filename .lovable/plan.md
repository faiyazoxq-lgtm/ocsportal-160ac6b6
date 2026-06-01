## Scope

Extend the just-completed engineer workflow with: expense editing + receipt uploads with on-device camera capture, AI-powered receipt extraction (vendor / items / totals / receipt no. / date / time / payment method), a new Dispatcher **Expenses** page with vendor outstanding totals and payment history, a `FullWorkOrderEditor` for Dispatcher/Boss that can edit every field, and a **Push to Expenses** acknowledgement step required before a submitted work order can be closed.

Nothing in the recent engineer-workflow pass is removed or restyled.

## What gets built

### 1. Schema migration (one migration)

Extend `public.work_order_expenses`:

- `vendor text`, `expense_date date`, `expense_time time`, `receipt_number text`, `payment_method text` (enum-as-text: `cash`, `card`, `bank_transfer`, `account`, `other`), `payment_status` (enum: `pending`, `paid`, `not_billable`), `paid_at timestamptz`, `paid_by uuid`, `extracted_items_json jsonb default '[]'`, `extracted_text text`, `extraction_status text default 'none'` (`none|pending|partial|done|failed`), `extraction_confidence numeric`, `updated_at timestamptz default now()`, `updated_by_profile_id uuid`, `updated_by_engineer_id uuid`.
- Trigger to maintain `updated_at`.
- RLS additions: **lead engineers** UPDATE/DELETE their own job's expenses while the work order is still field-editable (mirrors current `engineer_is_lead` gate); dispatcher/boss already have ALL.
- `GRANT` already in place; no new tables.

Extend `public.work_orders`:

- `expenses_pushed_at timestamptz`, `expenses_pushed_by uuid`, `expenses_ack_required boolean default true`.

(No change to status enum; the close action in the dispatcher review flow checks `expenses_pushed_at IS NOT NULL OR no expenses exist`.)

`public.work_order_files`: no schema change. Receipt uploads continue to use the existing `receipt_photo` `file_kind` and the existing `work-order-receipts` bucket; we link them via `work_order_expenses.receipt_file_id` (already present).

### 2. Receipt extraction (TanStack server fn)

`src/lib/receiptExtraction.functions.ts` — `extractReceipt({ workOrderId, fileId })`:

1. Auth via `requireSupabaseAuth`; verify caller can write to that work order (lead engineer / dispatcher / boss).
2. Signed URL for the stored file (`work-order-receipts` bucket).
3. Calls Lovable AI Gateway with `openai/gpt-5` (user pick — strong on messy receipts) via the AI SDK + `Output.object` schema for: `vendor`, `total_amount`, `currency`, `date`, `time`, `receipt_number`, `payment_method`, `items[]`, plus `confidence` and `raw_text`.
4. Stores extracted fields and `raw_text` on the expense row, sets `extraction_status` to `done` / `partial` / `failed`. Original file is never modified.
5. Returns the structured payload to the client for review/correction before commit.

Server helper `src/lib/ai-gateway.server.ts` (provider helper from `ai-sdk-lovable-gateway`). Bearer attacher already wired.

### 3. Engineer-side UI

- `src/components/engineer/EngineerExpensesSection.tsx` — replaces the inline list inside the existing `EngineerExpenses.tsx`; renders existing add form + new edit/delete rows. Gated by the same lead-engineer check the editor uses today; support engineers see read-only.
- `src/components/engineer/ExpenseEditorRow.tsx` — inline edit with all new fields, payment status, vendor, etc.
- `src/components/engineer/ExpenseReceiptUpload.tsx` — drop zone + `<input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" capture="environment">` for mobile camera capture. Uploads via existing `uploadEvidence` (kind `receipt_photo`), then immediately invokes `extractReceipt`.
- `src/components/engineer/ReceiptExtractionPreview.tsx` — shows extracted fields, lets the user accept / edit before saving onto the expense row. Falls back to "raw text only" panel when structured extraction is weak.
- `src/components/engineer/ExpenseAttachmentList.tsx` — thumbnails / file rows with signed-URL preview using existing `signedUrl` helper.

### 4. Dispatcher Expenses page

- Route: `src/routes/admin.expenses.tsx` (sits in the existing admin layout, picks up existing nav). Nav entry added in `DispatcherShell.tsx` next to Billing.
- `src/components/admin/expenses/DispatcherExpensesPage.tsx` — table grouped by work order with collapsible rows; filters: vendor, payment status, work order, date range.
- `src/components/admin/expenses/VendorOutstandingSummary.tsx` — totals per vendor for `payment_status = 'pending'`, plus grand totals for pending and pushed.
- `src/components/admin/expenses/ExpensePaymentStatusBadge.tsx` — color-coded (`pending` amber, `paid` green, `not_billable` slate).
- Add/edit dialog reuses `ExpenseEditorRow` (shared between engineer and dispatcher).
- Boss already inherits via existing boss RLS + the same route.

### 5. Push-to-Expenses gating

- `src/components/admin/review/PushToExpensesAction.tsx` mounted inside the existing `CompletionReviewDrawer`. Button is disabled when no expenses or already pushed; otherwise it stamps `expenses_pushed_at` / `_by` and inserts a `work_order_events` row (`expenses_pushed`).
- The existing review "Mark complete / close" button becomes disabled while the work order has expenses but `expenses_pushed_at IS NULL`. Tooltip explains why.

### 6. Full work-order editor for Dispatcher / Boss

- `src/components/admin/FullWorkOrderEditor.tsx` — single drawer-style form covering every column on `work_orders` that's safe to edit (client, addresses, summary, description, primary trade, complexity, priority, duration, value, schedule fields, admin notes). Reuses existing select / input primitives.
- Triggered from `WorkOrderDetail.tsx` via an "Edit Work Order" button gated to `dispatcher` / `boss`.
- Persists via a new `useUpdateWorkOrderFull` hook that wraps the same update + audit pattern as the engineer editor and writes a `work_order_events` row (`dispatcher_edit` / `boss_edit`). Invalidates the same query keys engineer edit does, so changes propagate across all pages immediately.
- Boss audit log: when `is_boss(auth.uid())`, also inserts a `boss_audit_log` entry (`job_edited`).

### 7. Hooks

`src/hooks/useWorkOrderExpenses.ts` — list, with realtime invalidation already covered by existing `RealtimeSync.tsx`.
`useUpsertWorkOrderExpense`, `useDeleteWorkOrderExpense`, `useExpenseReceiptUpload`, `useReceiptExtraction`, `useDispatcherExpenses`, `useVendorExpenseTotals`, `usePushWorkOrderExpenses`, `useUpdateWorkOrderFull`. All follow existing react-query patterns and invalidate `work_order_expenses`, `work_orders`, `work_order_files`.

### 8. Types

`src/types/expenses.ts` — extended `WorkOrderExpense` interface; `PaymentStatus`, `PaymentMethod` literal unions.

## Files changed

Added (≈14): the components/hooks/route/server fn listed above + `src/lib/ai-gateway.server.ts`.
Edited (≈7): `src/components/engineer/EngineerExpenses.tsx` (delegates to new section), `src/routes/engineer.jobs.$id.tsx` (already mounts expenses; no UI restructure), `src/components/admin/WorkOrderDetail.tsx` (add Edit + push-to-expenses), `src/components/admin/review/CompletionReviewDrawer.tsx` (gating + push action), `src/components/DispatcherShell.tsx` (Expenses nav entry), `src/start.ts` (only if missing — confirm attachSupabaseAuth is wired before adding), `src/hooks/useExpenses.ts` (extended select; backwards compatible).

## What is **not** changed

- Existing engineer home (Today / Outstanding / Previous tabs), `EngineerWorkOrderEditor`, `WorkOrderUpdatedBadge`, `AdditionalMediaUploadSection`, removed checklist items — all untouched.
- Boss / People / Intake / Diary / route structure: no redesign.
- Existing role gating and RLS posture preserved; engineers stay read-only on non-lead jobs; support engineers stay read-only on expenses.

## Sequencing inside this build

1. Submit migration.
2. After approval, write server fn + hooks + components + routes + nav + dispatcher page + full editor in one pass.
3. Verify build, sanity-check key flows.
