import { createFileRoute, Link } from "@tanstack/react-router";

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { h: string; body: string }[];
};

function PolicyPage({ eyebrow, title, intro, sections }: Props) {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{eyebrow}</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[7vw]">{title}</h1>
        <p className="mt-6 max-w-2xl text-mute">{intro}</p>
      </header>
      <div className="mx-auto max-w-3xl px-5 pb-32 lg:px-10">
        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-3xl">{s.h}</h2>
              <p className="mt-3 whitespace-pre-line text-graphite">{s.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-16 border-t border-line pt-8 text-[12px] uppercase tracking-[0.18em] text-mute">
          Questions?{" "}
          <Link to="/contact" className="text-ink hover:underline">
            Contact us →
          </Link>
        </div>
      </div>
    </div>
  );
}

export { PolicyPage };

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping — Ink Studio" },
      {
        name: "description",
        content: "Delivery times, charges, and tracking for Ink Studio orders.",
      },
      { property: "og:title", content: "Shipping — Ink Studio" },
      {
        property: "og:description",
        content: "Delivery times, charges, and tracking for Ink Studio orders.",
      },
      { property: "og:url", content: "/shipping" },
    ],
    links: [{ rel: "canonical", href: "/shipping" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Shipping."
      intro="Heavyweight pieces, light delivery times. Here's exactly how it works."
      sections={[
        {
          h: "Delivery times",
          body: "India: 2–4 business days for metros, 4–6 days for the rest. International: 5–9 business days. Anime drops ship 24 hours after the drop window closes.",
        },
        {
          h: "Charges",
          body: "Free shipping on India orders over ₹999. Below that, a flat ₹79 applies. International rates are calculated at checkout based on weight and destination.",
        },
        {
          h: "Tracking",
          body: "You'll get an email and SMS the moment your order ships, with a live tracking link. You can also track from your account dashboard.",
        },
        {
          h: "Cash on Delivery",
          body: "Available across India on orders below ₹5,000. A small ₹40 handling fee applies.",
        },
      ]}
    />
  ),
});
