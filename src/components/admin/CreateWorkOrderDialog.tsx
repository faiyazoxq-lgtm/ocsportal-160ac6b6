import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "New work order" entry point. Previously opened a popup form — now
 * navigates the user to the dedicated /admin/work-orders/new page so they
 * have room to fill the form out. After successful creation that page
 * shows the downloadable / printable work-order document.
 *
 * Kept the same export name + props so the existing call sites
 * (DispatcherShell, BossShell, admin.dispatch, admin.intake) keep working.
 */
export function CreateWorkOrderDialog({
  triggerLabel = "Create work order",
  triggerSize = "sm",
  triggerVariant,
}: {
  triggerLabel?: string;
  triggerSize?: "sm" | "default";
  triggerVariant?: "default" | "outline" | "secondary";
} = {}) {
  return (
    <Button asChild size={triggerSize} variant={triggerVariant} className="gap-1.5">
      <Link to="/admin/work-orders/new">
        <Plus className="h-3.5 w-3.5" />
        {triggerLabel}
      </Link>
    </Button>
  );
}
