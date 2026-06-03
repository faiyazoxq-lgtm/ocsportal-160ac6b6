import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Mail, RefreshCw, Send, Tag, XCircle, FileText, ExternalLink, Trash2 } from "lucide-react";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMailboxConnection } from "@/hooks/useGoogleMailboxConnection";
import {
  syncGmailInbox,
  triageGmailMessage,
  importGmailMessageToIntake,
  replyToGmailMessage,
  deleteGmailMessage,
} from "@/lib/gmail.functions";

export const Route = createFileRoute("/boss/inbox")({
  head: () => ({ meta: [{ title: "Boss · Inbox" }] }),
  component: BossInboxPage,
});

type Filter = "all" | "unread" | "candidate" | "review" | "imported" | "replied" | "ignored";

interface GmailRow {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  internal_date: string | null;
  from_address: string | null;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  body_preview: string | null;
  has_attachments: boolean;
  is_unread: boolean;
  classification: "unclassified" | "work_order_candidate" | "not_work_order" | "imported" | "ignored";
  classification_score: number | null;
  classification_reasons_json: string[] | null;
  triage_state: "pending" | "reviewed" | "replied" | "ignored";
  imported_intake_id: string | null;
  replied_at: string | null;
}

function useInbox(filter: Filter, mailboxEmail: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["gmail", "inbox", filter, mailboxEmail ?? ""],
    enabled: enabled && !!mailboxEmail,
    queryFn: async () => {
      const email = (mailboxEmail ?? "").trim();
      let q = supabase
        .from("gmail_messages")
        .select("id, gmail_message_id, gmail_thread_id, internal_date, from_address, from_name, subject, snippet, body_preview, has_attachments, is_unread, classification, classification_score, classification_reasons_json, triage_state, imported_intake_id, replied_at")
        .is("inbox_removed_at", null)
        .order("internal_date", { ascending: false })
        .limit(200);
      if (email) {
        const lower = email.toLowerCase();
        // Only show messages addressed to (or cc'd to) the currently linked mailbox.
        q = q.or(
          `to_addresses.cs.{${lower}},cc_addresses.cs.{${lower}},to_addresses.cs.{${email}},cc_addresses.cs.{${email}}`,
        );
      }
      if (filter === "unread") q = q.eq("is_unread", true);
      if (filter === "candidate") q = q.eq("classification", "work_order_candidate");
      if (filter === "review") q = q.eq("triage_state", "pending");
      if (filter === "imported") q = q.eq("classification", "imported");
      if (filter === "replied") q = q.eq("triage_state", "replied");
      if (filter === "ignored") q = q.in("classification", ["ignored", "not_work_order"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as GmailRow[];
    },
  });
}

function classBadge(c: GmailRow["classification"], score: number | null) {
  const map: Record<GmailRow["classification"], string> = {
    unclassified: "bg-muted text-muted-foreground",
    work_order_candidate: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    not_work_order: "bg-muted text-muted-foreground",
    imported: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    ignored: "bg-muted/50 text-muted-foreground",
  };
  const label: Record<GmailRow["classification"], string> = {
    unclassified: "Unclassified",
    work_order_candidate: "Work-order candidate",
    not_work_order: "Not work order",
    imported: "Imported",
    ignored: "Ignored",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${map[c]}`}>
      <Tag className="h-3 w-3" /> {label[c]}{score != null ? ` · ${Math.round(score * 100)}%` : ""}
    </span>
  );
}

function BossInboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: connection, isLoading: connLoading } = useGoogleMailboxConnection();
  const isConnected = connection?.record?.is_connected ?? false;
  const mailboxEmail = connection?.record?.email_address ?? null;
  const { data: rows = [], isLoading } = useInbox(filter, mailboxEmail, isConnected);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  const qc = useQueryClient();
  const sync = useServerFn(syncGmailInbox);
  const syncMut = useMutation({
    mutationFn: () => sync({ data: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "candidate", label: "Likely work order" },
    { id: "review", label: "Review needed" },
    { id: "imported", label: "Imported to intake" },
    { id: "replied", label: "Replied" },
    { id: "ignored", label: "Ignored" },
  ];

  return (
    <BossAccessGuard>
      <BossShell>
        <header className="surface-glow mb-5 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-6 md:py-6">
          <div className="min-w-0">
            <span className="glow-badge mb-3">Boss · Inbox</span>
            <h1 className="font-display flex items-center gap-2 text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              <span className="icon-glow h-9 w-9"><Inbox className="h-4 w-4" /></span>
              Company inbox
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Live view of {mailboxEmail ? <span className="font-medium text-foreground">{mailboxEmail}</span> : "the connected Gmail mailbox"}. Only messages addressed to this mailbox are shown.
            </p>
          </div>
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending || !isConnected}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            {syncMut.isPending ? "Syncing…" : "Sync now"}
          </button>
        </header>

        {!isConnected ? (
          <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
            <h2 className="text-sm font-semibold">No Google account linked</h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Connect the company Gmail mailbox from Infrastructure to start receiving inbound emails here.
              {connLoading ? " Checking connection…" : ""}
            </p>
            <Link
              to="/boss/infrastructure"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Go to Infrastructure
            </Link>
          </div>
        ) : (
        <>
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:h-[calc(100vh-13rem)]">
          <section className="flex flex-col rounded-md border border-border bg-card overflow-hidden">
            {isLoading ? (
              <p className="p-4 text-xs text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Mail className="mx-auto mb-2 h-6 w-6 opacity-50" />
                No messages. Click <strong>Sync now</strong> to fetch from Gmail.
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-border overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                        selected?.id === r.id ? "bg-accent/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${r.is_unread ? "font-semibold" : ""}`}>
                          {r.from_name ?? r.from_address ?? "Unknown"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {r.internal_date ? new Date(r.internal_date).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-foreground">{r.subject ?? "(no subject)"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.snippet ?? ""}</div>
                      <div className="mt-1.5">{classBadge(r.classification, r.classification_score)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col rounded-md border border-border bg-card overflow-hidden min-h-[70vh] lg:min-h-0">
            {selected ? <ThreadPanel row={selected} /> : <p className="p-4 text-xs text-muted-foreground">Select a message.</p>}
          </section>
        </div>
        </>
        )}
      </BossShell>
    </BossAccessGuard>
  );
}

function ThreadPanel({ row }: { row: GmailRow }) {
  const qc = useQueryClient();
  const triage = useServerFn(triageGmailMessage);
  const importFn = useServerFn(importGmailMessageToIntake);
  const reply = useServerFn(replyToGmailMessage);
  const del = useServerFn(deleteGmailMessage);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gmail"] });

  const triageMut = useMutation({
    mutationFn: (action: "mark_work_order" | "mark_not_work_order" | "ignore" | "mark_reviewed") =>
      triage({ data: { messageId: row.id, action } }),
    onSuccess: invalidate,
  });
  const importMut = useMutation({
    mutationFn: () => importFn({ data: { messageId: row.id } }),
    onSuccess: invalidate,
  });

  const [body, setBody] = useState("");
  const replyMut = useMutation({
    mutationFn: () => reply({ data: { messageId: row.id, body } }),
    onSuccess: () => { setBody(""); invalidate(); },
  });

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { messageId: row.id } }),
    onSuccess: invalidate,
  });

  const reasons = row.classification_reasons_json ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{row.subject ?? "(no subject)"}</h2>
            <p className="truncate text-xs text-muted-foreground">
              From <span className="font-medium text-foreground">{row.from_name ?? row.from_address}</span>
              {row.from_address && row.from_name ? ` <${row.from_address}>` : ""}
              {row.internal_date && ` · ${new Date(row.internal_date).toLocaleString()}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {classBadge(row.classification, row.classification_score)}
            {row.has_attachments && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <FileText className="h-3 w-3" /> attachment(s)
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {reasons.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2.5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Why this score</p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {reasons.map((r, i) => <li key={i}>· {r}</li>)}
            </ul>
          </div>
        )}
        <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-[13px] leading-relaxed">
          {row.body_preview ?? row.snippet ?? "(no body)"}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border px-4 py-2">
        {row.imported_intake_id ? (
          <Link
            to="/admin/intake"
            search={{ focus: undefined }}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
          >
            <ExternalLink className="h-3 w-3" /> View in intake
          </Link>
        ) : (
          <button
            onClick={() => importMut.mutate()}
            disabled={importMut.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Import to intake
          </button>
        )}
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {row.classification !== "work_order_candidate" && (
            <button onClick={() => triageMut.mutate("mark_work_order")} className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent">Mark work order</button>
          )}
          {row.classification !== "not_work_order" && (
            <button onClick={() => triageMut.mutate("mark_not_work_order")} className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent">Not a work order</button>
          )}
          {row.classification !== "ignored" && (
            <button onClick={() => triageMut.mutate("ignore")} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent">
              <XCircle className="h-3 w-3" /> Ignore
            </button>
          )}
          <button
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Delete this email from Gmail and the OCS inbox? It will be moved to Gmail Trash.",
                )
              )
                return;
              deleteMut.mutate();
            }}
            disabled={deleteMut.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> {deleteMut.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2">
        <p className="mb-1.5 text-[11px] text-muted-foreground">
          Reply to <span className="font-medium text-foreground">{row.from_address}</span>
        </p>
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim() && !replyMut.isPending) {
                e.preventDefault();
                replyMut.mutate();
              }
            }}
            rows={2}
            placeholder="Type a message…  (⌘/Ctrl + Enter to send)"
            className="max-h-40 min-h-[40px] flex-1 resize-y rounded-2xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => replyMut.mutate()}
            disabled={!body.trim() || replyMut.isPending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {replyMut.error && (<p className="mt-1.5 text-xs text-destructive">{(replyMut.error as Error).message}</p>)}
      </div>

      {(triageMut.error || importMut.error) && (
        <p className="shrink-0 px-4 pb-2 text-xs text-destructive">{(triageMut.error as Error)?.message ?? (importMut.error as Error)?.message}</p>
      )}
    </div>
  );
}