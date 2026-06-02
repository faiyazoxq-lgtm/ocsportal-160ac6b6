export interface ContactsTabDef {
  id: string;
  label: string;
  count?: number;
}

export function ContactsTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly ContactsTabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Contacts groups"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" ? (
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}