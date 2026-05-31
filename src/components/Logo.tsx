export function Logo({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const fg = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const sub = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";
  const ring = variant === "light" ? "border-sidebar-border" : "border-border";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-sm border ${ring} bg-background/10 text-[11px] font-semibold tracking-widest ${fg}`}
        aria-label="OCS logo placeholder"
      >
        OCS
      </div>
      <div className="leading-tight">
        <div className={`text-sm font-semibold ${fg}`}>On Call Services</div>
        <div className={`text-[10px] uppercase tracking-wider ${sub}`}>
          Operations Console
        </div>
      </div>
    </div>
  );
}