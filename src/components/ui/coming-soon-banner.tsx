import { Sparkles } from "lucide-react";

/**
 * ComingSoonBanner — Phase 2 (audit item 2.4–2.10).
 *
 * Renders a subtle banner at the top of marketing pages that currently
 * display hardcoded "coming soon" content (membership, creators, blog,
 * lookbook, gift-guide, etc.). Tells the user honestly that the page is
 * a placeholder rather than letting "Join →" buttons silently no-op.
 */
export function ComingSoonBanner({
  feature,
  message,
}: {
  /** Short feature name, e.g. "Membership tiers", "Creator profiles" */
  feature: string;
  /** Optional longer description. */
  message?: string;
}) {
  return (
    <div role="status" className="border-b border-line bg-fog/60">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-mute lg:px-10">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="font-medium text-ink">{feature} — coming soon</span>
        {message && <span className="hidden text-mute lg:inline">· {message}</span>}
      </div>
    </div>
  );
}
