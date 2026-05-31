import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyContactProfile, useTelegramLink } from "@/hooks/useTelegramLink";

export function TelegramLinkPanel() {
  const { data: cp, isLoading } = useMyContactProfile();
  const { link, unlink } = useTelegramLink();
  const [username, setUsername] = useState("");

  if (isLoading) {
    return <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">Loading…</div>;
  }

  if (cp?.telegram_chat_id) {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-sky-600" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-foreground">
              Telegram linked
            </div>
            <div className="text-xs text-muted-foreground">
              @{cp.telegram_username} · notifications will be sent here for new messages.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="text-sm font-semibold text-foreground">Connect Telegram</div>
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>Open Telegram and start the OCS bot by sending it <code>/start</code>.</li>
        <li>Enter your Telegram username below, then press Link.</li>
      </ol>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) link.mutate(username.trim());
        }}
      >
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@your_username"
        />
        <Button type="submit" size="sm" disabled={link.isPending || !username.trim()}>
          {link.isPending ? "Linking…" : "Link"}
        </Button>
      </form>
    </div>
  );
}