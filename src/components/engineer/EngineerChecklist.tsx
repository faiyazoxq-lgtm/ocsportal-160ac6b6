import {
  UNIVERSAL_CHECKLIST,
  type ChecklistItem,
} from "@/types/engineerField";

export function EngineerChecklist({
  primaryTrade,
  values,
  onChange,
  disabled,
}: {
  primaryTrade: string | null;
  values: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  disabled?: boolean;
}) {
  const Section = ({ title, items }: { title: string; items: ChecklistItem[] }) => (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item) => {
          const checked = !!values[item.key];
          return (
            <li key={item.key}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm ${
                  disabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent/30"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ ...values, [item.key]: e.target.checked })
                  }
                />
                <span className={checked ? "text-foreground" : "text-foreground/80"}>
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title="Universal checklist" items={UNIVERSAL_CHECKLIST} />
    </div>
  );
}