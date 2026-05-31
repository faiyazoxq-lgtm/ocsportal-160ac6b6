import logoUrl from "@/assets/ocs-logo.png";

export function Logo({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const fg = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const sub = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex h-9 w-12 items-center justify-center rounded-sm ${
          variant === "dark" ? "bg-foreground" : ""
        }`}
      >
        <img
          src={logoUrl}
          alt="OCS - On Call Services"
          className="h-6 w-auto object-contain"
        />
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