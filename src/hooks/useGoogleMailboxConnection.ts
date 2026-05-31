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
      // Redirect in the same window so the OAuth return page can finalize
      // and refresh the connection status reliably (new-tab flows leave
      // the original page stuck on "Opening Google…" with no completion signal).
      window.location.assign(authorizationUrl);
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