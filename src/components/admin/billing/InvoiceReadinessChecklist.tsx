import { Check, X } from "lucide-react";
import type { ReadinessItem } from "@/hooks/useBilling";

export function InvoiceReadinessChecklist({ items }: { items: ReadinessItem[] }) {
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Invoice readiness
      </h3>
      <ul className="space-y-1.5 text-xs">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2">
            {i.ok ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <X className="h-3.5 w-3.5 text-red-700" />
            )}
            <span className={i.ok ? "text-foreground" : "text-muted-foreground"}>
              {i.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}