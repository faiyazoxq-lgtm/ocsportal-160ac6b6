import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGmailMailboxStatus,
  startGmailOAuth,
  disconnectGmailMailbox,
  syncGmailInbox,
} from "@/lib/gmail.functions";

export function useGoogleMailboxConnection() {
  const qc = useQueryClient();
  const status = useServerFn(getGmailMailboxStatus);
  const startOAuth = useServerFn(startGmailOAuth);
  const disconnect = useServerFn(disconnectGmailMailbox);
  const sync = useServerFn(syncGmailInbox);

  const query = useQuery({
    queryKey: ["gmail", "status"],
    queryFn: () => status({}),
    refetchOnWindowFocus: false,
  });

  const connectMut = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}/oauth/gmail/return`;
      const { authorizationUrl } = await startOAuth({ data: { returnUrl } });
      window.location.href = authorizationUrl;
      return { authorizationUrl };
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