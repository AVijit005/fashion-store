import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warn" | "negative" | "info" | "muted";

const TONE: Record<Tone, string> = {
  neutral: "border-ink/20 bg-paper text-ink",
  positive: "border-ink/15 bg-ink text-paper",
  warn: "border-accent/40 bg-accent/10 text-accent",
  negative: "border-accent/40 bg-accent text-accent-foreground",
  info: "border-ink/10 bg-fog text-ink",
  muted: "border-line bg-paper text-mute",
};

export function StatusChip({
  label,
  tone = "neutral",
  dot = true,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em]",
        TONE[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "positive"
              ? "bg-paper"
              : tone === "negative"
                ? "bg-paper"
                : tone === "warn"
                  ? "bg-accent"
                  : "bg-ink",
          )}
        />
      )}
      {label}
    </span>
  );
}

const ORDER_TONE: Record<string, Tone> = {
  pending: "warn",
  paid: "info",
  fulfilled: "info",
  shipped: "info",
  delivered: "positive",
  refunded: "negative",
  cancelled: "muted",
};
export const orderTone = (s: string): Tone => ORDER_TONE[s] ?? "neutral";

const STUDIO_TONE: Record<string, Tone> = {
  new: "warn",
  in_review: "info",
  approved: "positive",
  in_production: "info",
  shipped: "info",
  rejected: "negative",
};
export const studioTone = (s: string): Tone => STUDIO_TONE[s] ?? "neutral";
