import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGmailMailboxStatus,
  disconnectGmailMailbox,
  syncGmailInbox,
  startGmailOAuth,
} from "@/lib/gmail.functions";

export function useGoogleMailboxConnection() {
  const qc = useQueryClient();
  const status = useServerFn(getGmailMailboxStatus);
  const disconnect = useServerFn(disconnectGmailMailbox);
  const sync = useServerFn(syncGmailInbox);
  const startOAuth = useServerFn(startGmailOAuth);

  const query = useQuery({
    queryKey: ["gmail", "status"],
    queryFn: () => status({}),
    refetchOnWindowFocus: false,
  });

  const connectMut = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}/oauth/gmail/return`;
      const { authorizationUrl } = await startOAuth({ data: { returnUrl } });
      // Open Google consent on the boss's device, in a new tab so the
      // Infrastructure page state is preserved.
      window.open(authorizationUrl, "_blank", "noopener,noreferrer");
      return { opened: true };
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmail"] });
      qc.invalidateQueries({ queryKey: ["boss", "overview"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: () => sync({ data: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });

  return { ...query, connectMut, disconnectMut, syncMut };
}