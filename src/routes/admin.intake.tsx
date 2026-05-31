import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { INTAKE_STATUSES } from "@/types/workOrders";
import { IntakeRecordsTable } from "@/components/admin/intake/IntakeRecordsTable";
import { IntakeReviewDrawer } from "@/components/admin/intake/IntakeReviewDrawer";
import { useIntakeQueue } from "@/hooks/useIntake";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/intake")({
  head: () => ({ meta: [{ title: "Intake Queue · OCS" }] }),
  component: IntakePage,
});

function IntakePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [intakeSelected, setIntakeSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useWorkOrders(INTAKE_STATUSES, {
    key: "intake",
  });
  const intake = useIntakeQueue();
  const qc = useQueryClient();

  async function seedSampleIntake() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("intake_records").insert({
      source_type: "email",
      source_reference: `sample-${Date.now()}@inbox`,
      raw_text:
        "From: repairs@camden-demo.gov.uk\nSubject: Boiler fault NW1\n\nTenant at 12 Greenleaf House, NW1 0EX reports boiler clicking then shutting down. No hot water.",
      extracted_fields_json: {
        client_name: "Camden Council Housing",
        address_line_1: "12 Greenleaf House",
        city: "London",
        postcode: "NW1 0EX",
        job_summary: "Boiler not firing - no hot water",
        job_description: "Tenant reports boiler clicking then shutting down.",
        contact_phone: "020 7946 0011",
      } as never,
      suggested_categorization_json: {
        primary_trade: "heating",
        complexity_level: "intermediate",
        priority_level: "high",
        postcode_zone: "NW1",
        engineers_required: 1,
        diary_ready: true,
      } as never,
      missing_fields_json: ["order_no"] as never,
      parsing_issues_json: [] as never,
      duplicate_candidates_json: [] as never,
      parse_status: "needs_review",
      parse_confidence: 0.78,
      categorization_confidence: 0.86,
      duplicate_confidence: 0,
      created_by: u.user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sample intake created");
    qc.invalidateQueries({ queryKey: ["intake_records"] });
  }

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-8">
          <AdminPageHeader
            title="Intake Queue"
            description="Jobs flowing in from email, PDF uploads, manual entry and webhooks."
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={seedSampleIntake}>
                  + Sample intake
                </Button>
                <CreateWorkOrderDialog />
              </div>
            }
          />

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Intake records · review &amp; convert
            </h2>
            <IntakeRecordsTable
              rows={intake.data}
              isLoading={intake.isLoading}
              error={intake.error}
              onRowClick={setIntakeSelected}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Work orders in intake pipeline
            </h2>
            <WorkOrderTable
              rows={data}
              isLoading={isLoading}
              error={error}
              onRowClick={setSelected}
              emptyMessage="No jobs are currently waiting in intake."
            />
          </section>
        </div>
        <WorkOrderDetail
          workOrderId={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
        <IntakeReviewDrawer
          intakeId={intakeSelected}
          open={!!intakeSelected}
          onOpenChange={(o) => !o && setIntakeSelected(null)}
        />
      </DispatcherShell>
    </ProtectedRoute>
  );
}