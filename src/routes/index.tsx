import { Navigate, createFileRoute } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/AuthStateScreen";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OCS Operations Console" },
      {
        name: "description",
        content:
          "Internal work order management platform for On Call Services dispatchers and field engineers.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "invalid_role") return <Navigate to="/unauthorized" replace />;
  if (status !== "authenticated" || !profile) return <Navigate to="/login" replace />;
  const dest =
    profile.role === "boss"
      ? "/boss/overview"
      : profile.role === "dispatcher"
        ? "/admin"
        : "/engineer";
  return (
    <Navigate to={dest} replace />
  );
}
