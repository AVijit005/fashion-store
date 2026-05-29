import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Ink Studio" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
