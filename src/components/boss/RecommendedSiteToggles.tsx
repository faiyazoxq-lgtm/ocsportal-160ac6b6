import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useGoogleMailboxConnection } from "@/hooks/useGoogleMailboxConnection";
import {
  updateIntakeSniffingEmail,
  updateGmailProcessedLabel,
} from "@/lib/companySettings.functions";

const DEFAULT_PROCESSED_LABEL = "OCS / Imported Work Orders";

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  onCheckedChange: (next: boolean) => void;
  hint?: string;
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  loading,
  onCheckedChange,
  hint,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              checked
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {checked ? "On" : "Off"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80 italic">{hint}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Switch
          checked={checked}
          disabled={disabled || loading}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}

export function RecommendedSiteToggles() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useSiteSettings();
  const { data: gmail, connectMut, disconnectMut } = useGoogleMailboxConnection();

  const connected = gmail?.record?.is_connected ?? false;
  const connectedEmail = gmail?.record?.email_address ?? null;
  const intakeOn = !!settings?.intake_sniffing_email;
  const autoMoveOn = !!settings?.gmail_processed_label;

  const saveSniff = useServerFn(updateIntakeSniffingEmail);
  const sniffMut = useMutation({
    mutationFn: (v: string | null) =>
      saveSniff({ data: { intake_sniffing_email: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });

  const saveLabel = useServerFn(updateGmailProcessedLabel);
  const labelMut = useMutation({
    mutationFn: (v: string | null) =>
      saveLabel({ data: { gmail_processed_label: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex items-start gap-2">
        <Settings2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Recommended site toggles</h2>
          <p className="text-[11px] text-muted-foreground">
            Quick on/off control for the most useful site-wide operational behaviors.
            All toggles are wired to live settings — changes take effect immediately.
          </p>
        </div>
      </header>

      <div>
        <ToggleRow
          title="Gmail mailbox sync"
          description="When on, the company Gmail mailbox is connected and inbound emails are fetched for parsing."
          checked={connected}
          loading={connectMut.isPending || disconnectMut.isPending}
          onCheckedChange={(next) => {
            if (next) connectMut.mutate();
            else disconnectMut.mutate();
          }}
          hint={connectedEmail ? `Connected: ${connectedEmail}` : undefined}
        />

        <ToggleRow
          title="Intake automation"
          description="When on, emails sent to the intake address are auto-routed into the parsing queue."
          checked={intakeOn}
          disabled={settingsLoading || (!intakeOn && !connectedEmail)}
          loading={sniffMut.isPending}
          onCheckedChange={(next) => {
            if (next) {
              const restore = connectedEmail;
              if (restore) sniffMut.mutate(restore);
            } else {
              sniffMut.mutate(null);
            }
          }}
          hint={
            !intakeOn && !connectedEmail
              ? "Connect the Gmail mailbox first to enable."
              : intakeOn
                ? `Watching: ${settings?.intake_sniffing_email}`
                : undefined
          }
        />

        <ToggleRow
          title="Auto-move processed emails"
          description="When on, Gmail messages successfully imported into intake are moved out of Inbox into a labeled folder."
          checked={autoMoveOn}
          loading={labelMut.isPending}
          onCheckedChange={(next) => {
            labelMut.mutate(next ? DEFAULT_PROCESSED_LABEL : null);
          }}
          hint={
            autoMoveOn
              ? `Folder: ${settings?.gmail_processed_label}`
              : "Processed emails will stay in Inbox."
          }
        />
      </div>

      <p className="mt-3 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        Need to change the intake address, processed-folder name, or Telegram notification
        preferences? Use the sections below.
      </p>
    </section>
  );
}