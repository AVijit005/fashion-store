import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl text-ink md:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-sm text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("border border-line bg-paper", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && (
            <h2 className="text-[11px] font-mono uppercase tracking-[0.22em] text-mute">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
