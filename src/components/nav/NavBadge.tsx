type Props = { count: number; muted?: boolean; urgent?: boolean };

export function NavBadge({ count, muted, urgent }: Props) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  if (urgent && !muted) {
    return (
      <span aria-label={`${count} pending`} className="ml-auto relative inline-flex">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
        <span className="relative inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-red-300/60 shadow-[0_0_12px_rgba(239,68,68,0.7)]">
          {display}
        </span>
      </span>
    );
  }
  return (
    <span
      aria-label={`${count} pending`}
      className={`ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
        muted
          ? "bg-sidebar-foreground/15 text-sidebar-foreground/60"
          : "bg-red-500 text-white"
      }`}
    >
      {display}
    </span>
  );
}