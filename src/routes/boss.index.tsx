import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/")({
  component: () => <Navigate to="/boss/overview" replace />,
});