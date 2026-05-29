import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Where do you ship?",
    a: "We ship across India in 2–4 days, and worldwide in 5–9 days. Free shipping on orders over ₹999.",
  },
  {
    q: "What's your return policy?",
    a: "15 days, no questions asked. We arrange free pickup from your doorstep for orders within India.",
  },
  {
    q: "How does sizing work?",
    a: "Our pieces run true to size with a relaxed, oversized cut. Use the size guide on each product page for measurements.",
  },
  {
    q: "Are anime drops limited?",
    a: "Yes — every anime collab is screen-printed in a numbered edition. Once sold out, we do not restock.",
  },
  {
    q: "Can I cancel my order?",
    a: "You can cancel any time before it ships. After shipment, follow the return process.",
  },
  {
    q: "How does Custom Print work?",
    a: "Design in our studio, see a live mockup, and we'll print and ship in 48 hours. No minimums.",
  },
];

export const Route = createFileRoute("/help-center")({
  head: () => ({
    meta: [
      { title: "Help Center — Ink Studio" },
      { name: "description", content: "Shipping, returns, sizing, and everything in between." },
      { property: "og:title", content: "Help Center — Ink Studio" },
      { property: "og:url", content: "/help-center" },
    ],
    links: [{ rel: "canonical", href: "/help-center" }],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Help center</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[8vw]">
          How can we <span className="italic">help?</span>
        </h1>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-32 lg:px-10">
        <ul>
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.04}>
              <li className="border-b border-line">
                <details className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="font-display text-2xl">{f.q}</span>
                    <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-graphite">{f.a}</p>
                </details>
              </li>
            </Reveal>
          ))}
        </ul>
        <div className="mt-16 border border-line bg-paper p-8 text-center">
          <p className="font-display text-3xl">Still stuck?</p>
          <p className="mt-2 text-mute">We reply within a few hours, every day.</p>
          <a
            href="mailto:hello@inkstudio.app"
            className="mt-6 inline-block bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
          >
            hello@inkstudio.app
          </a>
        </div>
      </div>
    </div>
  );
}
