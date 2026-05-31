import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useIntakeRecord,
  useUpdateIntakeFields,
  useRejectIntake,
  useConvertIntake,
  useParsingReviewHistory,
} from "@/hooks/useIntake";
import { ParseConfidenceBadge } from "./ParseConfidenceBadge";
import { IntakeRecommendationSummary } from "@/components/admin/recommendations/IntakeRecommendationSummary";
import { SourceMetadataPanel } from "./SourceMetadataPanel";
import { OriginalSourcePreview } from "./OriginalSourcePreview";
import { ParseMetadataPanel } from "./ParseMetadataPanel";
import { ExtractedTextPreview } from "./ExtractedTextPreview";
import { FieldReviewStatusBadge } from "./FieldReviewStatusBadge";
import { CriticalFieldsSummary } from "./CriticalFieldsSummary";
import { ReviewReadinessSummary } from "./ReviewReadinessSummary";
import { DuplicateCandidatesPanel } from "./DuplicateCandidatesPanel";
import { DuplicateStatusBadge } from "./DuplicateStatusBadge";
import { useReviewValidation } from "@/hooks/useReviewValidation";
import { useParseIntakeRecord } from "@/hooks/useIntakeParser";
import { Sparkles, ArrowRight } from "lucide-react";
import type {
  IntakeExtractedFields,
  IntakeSuggestedCategorization,
} from "@/types/intake";

interface Props {
  intakeId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const COMPLEXITY = ["basic", "intermediate", "advanced"] as const;
const PRIORITY = ["low", "normal", "high", "urgent"] as const;

export function IntakeReviewDrawer({ intakeId, open, onOpenChange }: Props) {
  const { data: record, isLoading } = useIntakeRecord(intakeId);
  const { data: history } = useParsingReviewHistory(intakeId);
  const updateMut = useUpdateIntakeFields();
  const rejectMut = useRejectIntake();
  const convertMut = useConvertIntake();
  const parseMut = useParseIntakeRecord();

  const [ex, setEx] = useState<IntakeExtractedFields>({});
  const [cat, setCat] = useState<IntakeSuggestedCategorization>({});
  const [rejectReason, setRejectReason] = useState("");
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (record) {
      setEx(record.extracted_fields_json ?? {});
      setCat(record.suggested_categorization_json ?? {});
      setOverrideWarnings(false);
    }
  }, [record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!record &&
    (JSON.stringify(ex) !== JSON.stringify(record.extracted_fields_json ?? {}) ||
      JSON.stringify(cat) !== JSON.stringify(record.suggested_categorization_json ?? {}));

  const validation = useReviewValidation({
    record: record ?? null,
    extracted: ex,
    categorization: cat,
    overrideWarnings,
  });
  const fieldByKey = Object.fromEntries(validation.fields.map((f) => [f.key, f]));
  function badge(key: string) {
    const f = fieldByKey[key];
    if (!f) return null;
    return <FieldReviewStatusBadge status={f.status} confidence={f.confidence} />;
  }

  const jumpTo = useCallback((key: string) => {
    const el = fieldRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    setTimeout(() => input?.focus(), 250);
  }, []);

  const missing = record?.missing_fields_json ?? [];
  const issues = record?.parsing_issues_json ?? [];

  async function saveEdits() {
    if (!record) return;
    try {
      await updateMut.mutateAsync({ id: record.id, extracted: ex, categorization: cat, prev: record });
      toast.success("Saved field edits");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function approveAndConvert() {
    if (!record) return;
    try {
      if (dirty) {
        await updateMut.mutateAsync({ id: record.id, extracted: ex, categorization: cat, prev: record });
      }
      const latest = { ...record, extracted_fields_json: ex, suggested_categorization_json: cat };
      const wo = await convertMut.mutateAsync({ record: latest });
      toast.success(`Converted to work order ${wo.order_no}`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reject() {
    if (!record) return;
    if (!rejectReason.trim()) {
      toast.error("Reason required to reject");
      return;
    }
    try {
      await rejectMut.mutateAsync({ id: record.id, reason: rejectReason, prevStatus: record.parse_status });
      toast.success("Intake rejected");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function runParse(force: boolean) {
    if (!record) return;
    try {
      const r = await parseMut.mutateAsync({ intakeId: record.id, force });
      toast.success(
        `Parsed via ${r.method} · ${(Math.round((r.parse_confidence ?? 0) * 100))}% confidence`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[920px]">
        <SheetHeader>
          <SheetTitle>Intake review</SheetTitle>
        </SheetHeader>

        {isLoading || !record ? (
          <div className="mt-6 h-40 animate-pulse rounded-md bg-muted/40" />
        ) : (
          <div className="mt-4 space-y-5">
            {/* Header / status */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-muted px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                {record.parse_status}
              </span>
              <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {record.source_type}
                {record.source_reference ? ` · ${record.source_reference}` : ""}
              </span>
              <ParseConfidenceBadge label="Parse" value={record.parse_confidence} />
              <ParseConfidenceBadge label="Categ" value={record.categorization_confidence} />
              <ParseConfidenceBadge label="Dup" value={record.duplicate_confidence} />
              <DuplicateStatusBadge
                status={record.duplicate_review_status}
                topScore={record.duplicate_confidence}
                candidateCount={record.duplicate_candidates_json?.length ?? 0}
              />
              {validation.nextIssueKey && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7"
                  onClick={() => jumpTo(validation.nextIssueKey!)}
                >
                  Jump to next issue
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>

            <CriticalFieldsSummary
              blockers={validation.blockers}
              warnings={validation.warnings}
              onJump={jumpTo}
            />

            {issues.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Parser notes:</span> {issues.join("; ")}
              </div>
            )}

            <IntakeRecommendationSummary record={record} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SourceMetadataPanel record={record} />
              <OriginalSourcePreview record={record} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ParseMetadataPanel record={record} />
              <div className="flex flex-col gap-2">
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Parser actions
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runParse(false)}
                      disabled={parseMut.isPending}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {record.parse_method ? "Re-run parse" : "Run parser"}
                    </Button>
                    {record.parse_method && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runParse(true)}
                        disabled={parseMut.isPending}
                      >
                        Force reprocess
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Re-run uses the current source file / raw text. Manual field edits will be overwritten.
                  </div>
                </div>
                <ExtractedTextPreview text={record.extracted_text} />
              </div>
            </div>

            {/* Side-by-side */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Raw source */}
              <section className="rounded-md border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Source
                </div>
                <div className="max-h-[420px] overflow-y-auto p-3">
                  {record.raw_text ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                      {record.raw_text}
                    </pre>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                      {JSON.stringify(record.raw_payload_json ?? {}, null, 2)}
                    </pre>
                  )}
                  {record.source_file_path && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      File: {record.source_bucket}/{record.source_file_path}
                    </div>
                  )}
                </div>
              </section>

              {/* Extracted fields editor */}
              <section className="rounded-md border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Extracted fields
                </div>
                <div className="space-y-2 p-3 text-sm">
                  <Field label="Order no" anchor={(el) => (fieldRefs.current.order_no = el)} meta={badge("order_no")}>
                    <Input value={ex.order_no ?? ""} onChange={(e) => setEx({ ...ex, order_no: e.target.value })} />
                  </Field>
                  <Field label="Client name" meta={badge("client_name")} required anchor={(el) => (fieldRefs.current.client_name = el)} help="Required for conversion — must identify the client/company.">
                    <Input value={ex.client_name ?? ""} onChange={(e) => setEx({ ...ex, client_name: e.target.value })} />
                  </Field>
                  <Field label="Address" meta={badge("address_line_1")} required anchor={(el) => (fieldRefs.current.address_line_1 = el)} help="Site address — required before dispatch.">
                    <Input value={ex.address_line_1 ?? ""} onChange={(e) => setEx({ ...ex, address_line_1: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="City" meta={badge("city")} anchor={(el) => (fieldRefs.current.city = el)}>
                      <Input value={ex.city ?? ""} onChange={(e) => setEx({ ...ex, city: e.target.value })} />
                    </Field>
                    <Field label="Postcode" meta={badge("postcode")} required anchor={(el) => (fieldRefs.current.postcode = el)} help="Drives postcode zone and routing.">
                      <Input value={ex.postcode ?? ""} onChange={(e) => setEx({ ...ex, postcode: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Job summary" meta={badge("job_summary")} anchor={(el) => (fieldRefs.current.job_summary = el)} help="Summary OR description required before conversion.">
                    <Input value={ex.job_summary ?? ""} onChange={(e) => setEx({ ...ex, job_summary: e.target.value })} />
                  </Field>
                  <Field label="Description" meta={badge("job_description")} anchor={(el) => (fieldRefs.current.job_description = el)}>
                    <Textarea rows={3} value={ex.job_description ?? ""} onChange={(e) => setEx({ ...ex, job_description: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Contact name" meta={badge("contact_name")} anchor={(el) => (fieldRefs.current.contact_name = el)}>
                      <Input value={ex.contact_name ?? ""} onChange={(e) => setEx({ ...ex, contact_name: e.target.value })} />
                    </Field>
                    <Field label="Contact phone" meta={badge("contact_phone")} anchor={(el) => (fieldRefs.current.contact_phone = el)}>
                      <Input value={ex.contact_phone ?? ""} onChange={(e) => setEx({ ...ex, contact_phone: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </section>
            </div>

            {/* Categorization */}
            <section className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                AI categorization (editable)
              </div>
              <div className="grid gap-2 p-3 md:grid-cols-3">
                <Field label="Primary trade">
                  <Input value={cat.primary_trade ?? ""} onChange={(e) => setCat({ ...cat, primary_trade: e.target.value })} />
                </Field>
                <Field label="Complexity">
                  <Select
                    value={cat.complexity_level ?? ""}
                    onValueChange={(v) => setCat({ ...cat, complexity_level: (v || null) as IntakeSuggestedCategorization["complexity_level"] })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {COMPLEXITY.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select
                    value={cat.priority_level ?? ""}
                    onValueChange={(v) => setCat({ ...cat, priority_level: (v || null) as IntakeSuggestedCategorization["priority_level"] })}
                  >
                    <SelectTrigger><SelectValue placeholder="normal" /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Postcode zone">
                  <Input value={cat.postcode_zone ?? ""} onChange={(e) => setCat({ ...cat, postcode_zone: e.target.value })} />
                </Field>
                <Field label="Engineers required">
                  <Input
                    type="number"
                    min={1}
                    value={cat.engineers_required ?? 1}
                    onChange={(e) => setCat({ ...cat, engineers_required: Number(e.target.value) || 1 })}
                  />
                </Field>
                <Field label="Diary-ready">
                  <Select
                    value={cat.diary_ready == null ? "" : cat.diary_ready ? "yes" : "no"}
                    onValueChange={(v) => setCat({ ...cat, diary_ready: v === "yes" ? true : v === "no" ? false : null })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            {/* Duplicates */}
            <DuplicateCandidatesPanel record={record} />

            {/* History */}
            {history && history.length > 0 && (
              <section className="rounded-md border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Review history
                </div>
                <ul className="divide-y divide-border text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="px-3 py-2">
                      <div className="font-medium text-foreground">{h.action_type}</div>
                      <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Conversion action bar */}
            <div className="sticky bottom-0 -mx-6 space-y-2 border-t border-border bg-card p-3">
              <ReviewReadinessSummary
                validation={validation}
                overrideWarnings={overrideWarnings}
                onToggleOverride={setOverrideWarnings}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Rejection reason (required to reject)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-72"
                  />
                  <Button variant="outline" onClick={reject} disabled={rejectMut.isPending}>
                    Reject
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={saveEdits} disabled={!dirty || updateMut.isPending}>
                    {updateMut.isPending ? "Saving…" : "Save edits"}
                  </Button>
                  <Button
                    onClick={approveAndConvert}
                    disabled={
                      convertMut.isPending ||
                      record.parse_status === "converted" ||
                      !validation.canApprove
                    }
                    title={
                      !validation.canApprove
                        ? validation.blockers.length > 0
                          ? "Resolve blockers first"
                          : "Acknowledge warnings to approve"
                        : undefined
                    }
                  >
                    {convertMut.isPending ? "Converting…" : "Approve & convert"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
  meta,
  anchor,
  required,
  help,
}: {
  label: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
  anchor?: (el: HTMLDivElement | null) => void;
  required?: boolean;
  help?: string;
}) {
  return (
    <div className="space-y-1" ref={anchor}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        {meta}
      </div>
      {children}
      {help ? <div className="text-[10px] text-muted-foreground">{help}</div> : null}
    </div>
  );
}