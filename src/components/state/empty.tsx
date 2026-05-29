import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: { label: string; to: string };
  secondary?: { label: string; to: string };
};

export function EmptyState({ icon, eyebrow, title, description, cta, secondary }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      {icon && <div className="mb-5 text-mute">{icon}</div>}
      {eyebrow && <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{eyebrow}</p>}
      <p className="mt-2 font-display text-4xl lg:text-5xl">{title}</p>
      {description && <p className="mt-3 max-w-md text-mute">{description}</p>}
      {(cta || secondary) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {cta && (
            <Link
              to={cta.to}
              className="bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
            >
              {cta.label}
            </Link>
          )}
          {secondary && (
            <Link
              to={secondary.to}
              className="border border-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em]"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
