import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&_button]:h-9 [&_a]:h-9">
          {actions}
        </div>
      )}
    </header>
  );
}