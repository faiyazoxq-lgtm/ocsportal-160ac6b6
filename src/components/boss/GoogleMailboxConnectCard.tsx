import { useGoogleMailboxConnection } from "@/hooks/useGoogleMailboxConnection";
import { Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export function GoogleMailboxConnectCard() {
  const { data, isLoading, connectMut, disconnectMut, syncMut } = useGoogleMailboxConnection();
  const rec = data?.record;
  const linked = data?.linked ?? false;
  const connected = rec?.is_connected ?? false;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Company Gmail mailbox</h2>
            {connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" /> Not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            No mailbox is connected. A per-account Google sign-in flow will let you connect your own Gmail
            from your device — nothing is attached automatically.
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading status…</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Connector linked</dt>
            <dd className="font-medium">{linked ? "Yes" : "No — link Gmail in Connections first"}</dd>
            <dt className="text-muted-foreground">Connected mailbox</dt>
            <dd className="font-medium">{rec?.email_address ?? "—"}</dd>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="font-medium">{rec?.last_sync_at ? new Date(rec.last_sync_at).toLocaleString() : "Never"}</dd>
            {rec?.last_sync_error && (
              <>
                <dt className="text-destructive">Last error</dt>
                <dd className="text-destructive">{rec.last_sync_error}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            {!connected ? (
              <button
                onClick={() => connectMut.mutate()}
                disabled
                title="Per-account Google sign-in coming soon"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50 cursor-not-allowed"
              >
                <Mail className="h-3.5 w-3.5" />
                Connect with Google (coming soon)
              </button>
            ) : (
              <>
                <button
                  onClick={() => syncMut.mutate()}
                  disabled={syncMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
                  {syncMut.isPending ? "Syncing…" : "Sync inbox now"}
                </button>
                <button
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>

          {connectMut.error && (
            <p className="text-xs text-destructive">{(connectMut.error as Error).message}</p>
          )}
          {syncMut.isSuccess && syncMut.data && (
            <p className="text-xs text-muted-foreground">
              Scanned {syncMut.data.scanned} · cached {syncMut.data.cached} new · auto-imported {syncMut.data.autoImported}
            </p>
          )}
        </div>
      )}
    </section>
  );
}