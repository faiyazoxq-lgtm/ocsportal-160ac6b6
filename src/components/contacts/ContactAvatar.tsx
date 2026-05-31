import type { ContactDirectoryEntry } from "@/types/contacts";

export function ContactAvatar({
  contact,
  size = 40,
}: {
  contact: Pick<ContactDirectoryEntry, "full_name" | "email" | "avatar_url">;
  size?: number;
}) {
  const initials =
    (contact.full_name || contact.email || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  if (contact.avatar_url) {
    return (
      <img
        src={contact.avatar_url}
        alt={contact.full_name ?? contact.email}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </div>
  );
}