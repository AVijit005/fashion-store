import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Sparkles,
  Palette,
  Settings,
  ArrowLeft,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: string;
}> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: "12" },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/drops", label: "Drops", icon: Sparkles, badge: "Live" },
  { to: "/admin/studio", label: "Studio requests", icon: Palette, badge: "3" },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex h-full flex-col border-r border-line bg-paper">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="Back to storefront"
          onClick={onNavigate}
        >
          <span className="flex h-7 w-7 items-center justify-center bg-ink text-paper">
            <span className="font-display text-[14px] leading-none">I</span>
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] text-ink">Ink Studio</p>
            <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-mute">Operations</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin sections">
        <p className="px-2 pb-2 text-[9px] font-mono uppercase tracking-[0.22em] text-mute">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to as never}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 px-2.5 py-2 text-[13px] transition",
                    active ? "bg-ink text-paper" : "text-ink/70 hover:bg-fog hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.18em]",
                        active ? "bg-paper/15 text-paper" : "bg-fog text-mute",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between border border-line bg-paper px-2.5 py-2 text-[11px] uppercase tracking-[0.18em] text-mute transition hover:border-ink/30 hover:text-ink"
          aria-label="Open command palette"
        >
          <span className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5" aria-hidden="true" />
            Quick actions
          </span>
          <kbd className="border border-line bg-paper px-1 font-mono text-[9px] tracking-normal text-mute">
            ⌘K
          </kbd>
        </button>
        <Link
          to="/"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to storefront
        </Link>
      </div>
    </aside>
  );
}
