import { createFileRoute } from "@tanstack/react-router";
import { AuthStateScreen } from "@/components/AuthStateScreen";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({ meta: [{ title: "Unauthorized · OCS" }] }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const { signOut } = useAuth();
  return (
    <AuthStateScreen
      title="Access not permitted"
      description="Your account does not have a valid role assigned for this workspace. Please contact your dispatch administrator."
    >
      <button
        onClick={() => void signOut()}
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Sign out
      </button>
    </AuthStateScreen>
  );
}