import { Marquee } from "@/components/ui/marquee";

const messages = [
  "Free shipping on orders over ₹999",
  "New drop — Anime Collection vol. 03",
  "Heavyweight cotton, made for drape",
  "Custom prints, shipped in 48 hours",
  "Returns within 15 days, no questions",
];

export function AnnouncementBar() {
  return (
    <div className="border-b border-line bg-ink py-2 text-[11px] uppercase tracking-[0.22em] text-paper">
      <Marquee speed={48}>
        {messages.map((m, i) => (
          <span key={i} className="inline-flex items-center gap-12">
            <span>{m}</span>
            <span className="opacity-40">✦</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
