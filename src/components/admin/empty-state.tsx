import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-8 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center border border-line bg-fog text-mute">
          {icon}
        </div>
      )}
      <p className="font-display text-2xl text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-mute">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
