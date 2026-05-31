import type { CommunicationType, CommunicationDirection } from "@/types/communications";
import { Phone, Mail, StickyNote, MapPin, MessageSquare, Voicemail, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const TYPE_ICONS: Record<CommunicationType, typeof Phone> = {
  call: Phone,
  email: Mail,
  note: StickyNote,
  visit: MapPin,
  message: MessageSquare,
  voicemail: Voicemail,
};

export function CommunicationTypeBadge({
  type,
  direction,
}: {
  type: CommunicationType;
  direction?: CommunicationDirection;
}) {
  const Icon = TYPE_ICONS[type];
  const DirIcon = direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-foreground">
      <Icon className="h-3 w-3" />
      {type}
      {direction && <DirIcon className="h-3 w-3 opacity-60" />}
    </span>
  );
}

export function FollowUpBadge({
  status,
  dueAt,
}: {
  status: import("@/types/communications").FollowUpStatus | null | undefined;
  dueAt?: string | null;
}) {
  if (!status || status === "not_required") return null;
  const overdue = dueAt && new Date(dueAt) < new Date() && status !== "resolved";
  const color =
    status === "resolved"
      ? "bg-emerald-100 text-emerald-900"
      : overdue
        ? "bg-red-100 text-red-900"
        : status === "awaiting_response" || status === "unresolved"
          ? "bg-amber-100 text-amber-900"
          : "bg-blue-100 text-blue-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${color}`}>
      {overdue ? "Overdue · " : ""}
      {status.replace(/_/g, " ")}
    </span>
  );
}