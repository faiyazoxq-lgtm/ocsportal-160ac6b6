import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DispatcherShell } from "@/components/DispatcherShell";
import { EngineerShell } from "@/components/EngineerShell";

export function ContactsShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role === "dispatcher") {
    return <DispatcherShell>{children}</DispatcherShell>;
  }
  return <EngineerShell>{children}</EngineerShell>;
}