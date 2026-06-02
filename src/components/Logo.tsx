import logoUrl from "@/assets/ocs-logo.png";

type Size = "sm" | "md" | "lg" | "xl" | "hero";

const SIZES: Record<Size, { box: string; img: string; gap: string; title: string; sub: string }> = {
  sm: { box: "h-8 w-10", img: "h-5", gap: "gap-2", title: "text-xs", sub: "text-[9px]" },
  md: { box: "h-9 w-12", img: "h-6", gap: "gap-2.5", title: "text-sm", sub: "text-[10px]" },
  lg: { box: "h-14 w-20", img: "h-10", gap: "gap-3.5", title: "text-lg", sub: "text-[11px]" },
  xl: { box: "h-20 w-28", img: "h-14", gap: "gap-4", title: "text-2xl", sub: "text-xs" },
  hero: { box: "h-28 w-36", img: "h-20", gap: "gap-5", title: "text-3xl", sub: "text-sm" },
};

export function Logo({
  variant = "dark",
  className = "",
  size = "md",
}: {
  variant?: "dark" | "light";
  className?: string;
  size?: Size;
}) {
  const fg = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const sub = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-sm ${s.box} ${
          variant === "dark" ? "bg-foreground" : ""
        }`}
      >
        <img
          src={logoUrl}
          alt="OCS - On Call Services"
          className={`${s.img} w-auto object-contain`}
        />
      </div>
      <div className="leading-tight">
        <div className={`${s.title} font-semibold tracking-tight ${fg}`}>On Call Services</div>
        <div className={`${s.sub} uppercase tracking-[0.18em] font-medium ${sub}`}>
          Operations Console
        </div>
      </div>
    </div>
  );
}