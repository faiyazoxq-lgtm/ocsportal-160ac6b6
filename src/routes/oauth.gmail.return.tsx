import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { finalizeGmailOAuth } from "@/lib/gmail.functions";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/oauth/gmail/return")({
  component: GmailOAuthReturn,
});

function GmailOAuthReturn() {
  const finalize = useServerFn(finalizeGmailOAuth);
  const qc = useQueryClient();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ok"; email: string } | { kind: "err"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const connectionId = params.get("connection_id") ?? "";
    const error = params.get("error");

    if (!success || !connectionId) {
      setState({ kind: "err", message: error ?? "Google sign-in was not completed." });
      return;
    }

    finalize({ data: { connectionId } })
      .then((r) => {
        setState({ kind: "ok", email: r.email });
        qc.invalidateQueries({ queryKey: ["gmail"] });
        qc.invalidateQueries({ queryKey: ["boss", "overview"] });
      })
      .catch((e: Error) => setState({ kind: "err", message: e.message }));
  }, [finalize, qc]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        {state.kind === "loading" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h1 className="text-lg font-semibold">Linking your Google account…</h1>
            <p className="text-sm text-muted-foreground">Hang tight while we finish setting things up.</p>
          </div>
        )}
        {state.kind === "ok" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <h1 className="text-lg font-semibold">Google account linked</h1>
            <p className="text-sm text-muted-foreground">Connected as <span className="font-medium">{state.email}</span></p>
            <Link
              to="/boss/infrastructure"
              className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Back to Infrastructure
            </Link>
          </div>
        )}
        {state.kind === "err" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-lg font-semibold">Couldn't link Google account</h1>
            <p className="text-sm text-destructive">{state.message}</p>
            <Link
              to="/boss/infrastructure"
              className="mt-2 inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Back to Infrastructure
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}