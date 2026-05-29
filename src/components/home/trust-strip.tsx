import { Reveal } from "@/components/ui/reveal";
import { Truck, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

const items = [
  { icon: Truck, title: "Free shipping", desc: "On orders above ₹999, across India." },
  { icon: RotateCcw, title: "15-day returns", desc: "No questions. Easy pickup." },
  { icon: ShieldCheck, title: "Secure checkout", desc: "Encrypted payments, every time." },
  { icon: Sparkles, title: "Made in small batches", desc: "Heavyweight cotton, real care." },
];

export function TrustStrip() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-2 gap-y-8 px-5 py-12 md:grid-cols-4 lg:gap-y-0 lg:px-10 lg:py-14">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.06} className="flex items-start gap-3">
            <it.icon className="mt-0.5 h-5 w-5 shrink-0 text-ink" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium">{it.title}</p>
              <p className="mt-0.5 text-[12px] text-mute">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
