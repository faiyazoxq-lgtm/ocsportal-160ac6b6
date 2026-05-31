import { useGoogleMailboxConnection } from "@/hooks/useGoogleMailboxConnection";
import { Mail, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";

function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export function GoogleMailboxConnectCard() {
  const { data, isLoading, connectMut, disconnectMut, syncMut } = useGoogleMailboxConnection();
  const rec = data?.record;
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
            Sign in with your own Google account on this device to link the company inbox. Inbound
            work-order emails are routed into intake, and replies are sent from the linked address.
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading status…</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
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
                type="button"
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
                className="inline-flex items-center gap-3 rounded-md border border-[#dadce0] bg-white pl-1 pr-4 py-[3px] text-sm font-medium text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8faff] hover:border-[#d2e3fc] active:bg-[#eef3fe] disabled:opacity-60 disabled:cursor-not-allowed font-[system-ui,'Roboto',Arial,sans-serif]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-white">
                  {connectMut.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#4285f4]" />
                  ) : (
                    <GoogleGLogo className="h-5 w-5" />
                  )}
                </span>
                <span>{connectMut.isPending ? "Redirecting to Google…" : "Sign in with Google"}</span>
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

          {!connected && (
            <p className="text-[11px] text-muted-foreground">
              Opens Google's sign-in in a new tab. After granting access you'll be redirected back here
              and the mailbox will appear as connected.
            </p>
          )}

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