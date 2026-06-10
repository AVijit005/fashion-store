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
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <header className="flex h-14 items-center border-b border-line bg-paper px-4">
          <div className="h-4 w-32 animate-pulse bg-fog/80" />
        </header>
        <div className="flex flex-1">
          <aside className="w-64 border-r border-line bg-paper p-4 hidden md:block">
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse bg-fog/80" />
              <div className="h-4 w-32 animate-pulse bg-fog/80" />
              <div className="h-4 w-20 animate-pulse bg-fog/80" />
            </div>
          </aside>
          <main className="flex-1 p-6">
             <div className="h-8 w-48 animate-pulse bg-fog/80 mb-6" />
             <div className="h-64 w-full animate-pulse bg-fog/80" />
          </main>
        </div>
      </div>
    );
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
