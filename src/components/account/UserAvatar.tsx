interface UserAvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

function initialsFor(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({ url, name, size = 32, className = "" }: UserAvatarProps) {
  const dim = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name} avatar` : "User avatar"}
        style={dim}
        className={`rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...dim, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      className={`flex items-center justify-center rounded-full bg-muted font-semibold uppercase text-muted-foreground ring-1 ring-border ${className}`}
      aria-label={name ? `${name} avatar` : "User avatar"}
    >
      {initialsFor(name)}
    </div>
  );
}