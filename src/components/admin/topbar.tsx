import { Bell, Menu, Search } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/admin": { eyebrow: "Today", title: "Overview" },
  "/admin/orders": { eyebrow: "Operations", title: "Orders" },
  "/admin/products": { eyebrow: "Catalog", title: "Products" },
  "/admin/customers": { eyebrow: "People", title: "Customers" },
  "/admin/drops": { eyebrow: "Capsules", title: "Drops" },
  "/admin/studio": { eyebrow: "Print studio", title: "Studio requests" },
  "/admin/settings": { eyebrow: "Workspace", title: "Settings" },
};

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const meta = TITLES[pathname] ?? { eyebrow: "Workspace", title: "Admin" };
  const now = new Date().toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="icon-btn flex h-9 w-9 items-center justify-center border border-line bg-paper text-ink lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="leading-tight">
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-mute">
            {meta.eyebrow}
          </p>
          <p className="font-display text-[15px] text-ink">{meta.title}</p>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center px-6 md:flex">
        <label className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search orders, products, customers…"
            className="h-9 w-full border border-line bg-paper pl-9 pr-12 text-[13px] outline-none transition placeholder:text-mute focus:border-ink"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 border border-line bg-paper px-1 font-mono text-[9px] text-mute">
            ⌘K
          </kbd>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-mute lg:block">
          {now}
        </p>
        <button
          type="button"
          aria-label="Notifications, 3 unread"
          className="icon-btn relative flex h-9 w-9 items-center justify-center border border-line bg-paper text-ink"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        </button>
        <div className="flex h-9 items-center gap-2 border border-line bg-paper px-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
            AM
          </span>
          <div className="hidden leading-tight md:block">
            <p className="text-[11px] text-ink">Aanya M.</p>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-mute">Founder</p>
          </div>
        </div>
      </div>
    </header>
  );
}
