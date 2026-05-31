import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOpsDiagnostics } from "@/lib/opsDiagnostics.functions";

export function useOpsDiagnostics() {
  const fn = useServerFn(getOpsDiagnostics);
  return useQuery({
    queryKey: ["ops-diagnostics"],
    queryFn: () => fn({ data: undefined as any }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}