import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNormalizationPreview, useApplyNormalization } from "@/hooks/useNormalization";
import { NormalizedValuePreview } from "./NormalizedValuePreview";
import { NormalizationWarningBadge } from "./NormalizationWarningBadge";
import { toast } from "sonner";
import type {
  IntakeExtractedFields,
  IntakeRecord,
  IntakeSuggestedCategorization,
} from "@/types/intake";

interface Props {
  record: IntakeRecord;
  extracted: IntakeExtractedFields;
  categorization: IntakeSuggestedCategorization;
}

export function NormalizationSummary({ record, extracted, categorization }: Props) {
  const preview = useNormalizationPreview({ extracted, categorization });
  const applyMut = useApplyNormalization();

  const warnings = preview.warnings.filter((w) => w.severity === "warn");
  const infos = preview.warnings.filter((w) => w.severity === "info");
  const warningByField = new Map(preview.warnings.map((w) => [w.field, w.message]));

  const appliedVersion = record.normalization_version;
  const appliedAt = record.normalization_applied_at;

  async function apply() {
    try {
      await applyMut.mutateAsync({ id: record.id, preview });
      toast.success("Normalization applied");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Normalization preview</span>
          <NormalizationWarningBadge count={warnings.length} severity="warn" />
          <NormalizationWarningBadge count={infos.length} severity="info" />
          {appliedVersion ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Applied {appliedVersion}
            </span>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={apply} disabled={applyMut.isPending}>
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          {applyMut.isPending ? "Applying…" : appliedVersion ? "Re-apply" : "Apply normalization"}
        </Button>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <NormalizedValuePreview
          label="Client"
          from={extracted.client_name}
          to={preview.normalized.client_name}
          warning={warningByField.get("client_name")}
        />
        <NormalizedValuePreview
          label="Address line 1"
          from={extracted.address_line_1}
          to={preview.normalized.address.line_1}
        />
        <NormalizedValuePreview
          label="Postcode"
          from={extracted.postcode}
          to={preview.normalized.address.postcode}
          warning={warningByField.get("postcode")}
        />
        <NormalizedValuePreview
          label="Postcode zone"
          from={categorization.postcode_zone ?? extracted.postcode_zone}
          to={preview.normalized.address.postcode_zone}
          warning={warningByField.get("postcode_zone")}
        />
        <NormalizedValuePreview
          label="Contact phone"
          from={extracted.contact_phone}
          to={preview.normalized.contact_phone}
          warning={warningByField.get("contact_phone")}
        />
        <NormalizedValuePreview
          label="Primary trade"
          from=
          to={preview.normalized.job_type}
          warning={warningByField.get("primary_trade")}
        />
        <NormalizedValuePreview
          label="Complexity"
          from=
          to=
          warning={warningByField.get("complexity_level")}
        />
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Client match</div>
          <div className="text-xs">
            {preview.normalized.client_id_suggested ? (
              <span className="rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                Linked to existing client
              </span>
            ) : (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground">
                No canonical client matched
              </span>
            )}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="border-t border-border bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" /> Normalization warnings
          </div>
          <ul className="ml-4 list-disc">
            {warnings.map((w, i) => (
              <li key={i}>
                <span className="font-medium">{w.field}:</span> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        Normalized values are previewed without overwriting the parsed source. Applying stores them
        for audit and uses them on conversion. Editable fields above still take precedence.
        {appliedAt ? ` Last applied ${new Date(appliedAt).toLocaleString()}.` : ""}
      </div>
    </section>
  );
}