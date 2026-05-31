type Props = { count: number; muted?: boolean };

export function NavBadge({ count, muted }: Props) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
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