import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAuthStore } from "@/lib/store/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Ink Studio" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Admin</p>
        <h1 className="mt-2 font-display text-5xl">Access denied.</h1>
        <p className="mt-2 text-mute">Use an administrator account to view this workspace.</p>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
