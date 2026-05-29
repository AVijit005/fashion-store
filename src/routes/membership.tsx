import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { Sparkles, Crown, Truck } from "lucide-react";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership — Ink Studio" },
      {
        name: "description",
        content: "Early drops, free shipping, and creator-only previews. Free to join.",
      },
      { property: "og:title", content: "Membership — Ink Studio" },
      { property: "og:url", content: "/membership" },
    ],
    links: [{ rel: "canonical", href: "/membership" }],
  }),
  component: MembershipPage,
});

const tiers = [
  {
    name: "Member",
    price: "Free",
    color: "bg-paper",
    text: "text-ink",
    perks: [
      "Free shipping over ₹999",
      "15-day no-questions returns",
      "Drop calendar access",
      "Studio newsletter",
    ],
  },
  {
    name: "Inner Circle",
    price: "₹999/yr",
    color: "bg-ink",
    text: "text-paper",
    perks: [
      "Everything in Member",
      "48h early drop access",
      "10% off every order",
      "Free expedited shipping",
      "Hand-written thank you",
    ],
    featured: true,
  },
  {
    name: "Studio",
    price: "By invite",
    color: "bg-fog",
    text: "text-ink",
    perks: [
      "Everything in Inner Circle",
      "Numbered editions reserved",
      "Studio visit invitations",
      "1:1 stylist sessions",
      "Custom print credit",
    ],
  },
];

function MembershipPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 text-center lg:px-10 lg:py-24">
        <Crown className="mx-auto h-6 w-6" />
        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-mute">Studio membership</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[7vw]">
          Wear the studio <span className="italic">first.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-mute">
          Early access to drops, free shipping, and members-only editions. Free to join.
        </p>
      </header>

      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-6 px-5 pb-20 lg:grid-cols-3 lg:px-10">
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <div
              className={`${t.color} ${t.text} flex h-full flex-col p-8 ${t.featured ? "lg:-translate-y-4 lg:shadow-ink" : "border border-line"}`}
            >
              {t.featured && (
                <p className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-paper/70">
                  <Sparkles className="h-3 w-3" /> Most popular
                </p>
              )}
              <p className="text-[11px] uppercase tracking-[0.22em] opacity-60">{t.name}</p>
              <p className="mt-3 font-display text-5xl">{t.price}</p>
              <ul className="mt-8 space-y-3 text-sm">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                to="/account"
                className={`mt-auto pt-10 block w-full py-4 text-center text-[12px] uppercase tracking-[0.22em] ${t.featured ? "bg-paper text-ink" : "bg-ink text-paper"}`}
              >
                Join →
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-6 px-5 py-16 md:grid-cols-3 lg:px-10">
          {[
            { i: Truck, t: "Free expedited shipping", b: "On every order, no minimums." },
            { i: Sparkles, t: "48h early drop access", b: "See it before the public does." },
            { i: Crown, t: "Reserved editions", b: "Your number, held for you." },
          ].map((p) => (
            <div key={p.t} className="flex items-start gap-4">
              <p.i className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="font-medium">{p.t}</p>
                <p className="mt-1 text-sm text-mute">{p.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
