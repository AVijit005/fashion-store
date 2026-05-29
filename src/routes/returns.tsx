import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "./shipping";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Returns & Exchanges — Ink Studio" },
      {
        name: "description",
        content: "15-day no-questions returns with free pickup across India.",
      },
      { property: "og:title", content: "Returns — Ink Studio" },
      {
        property: "og:description",
        content: "15-day no-questions returns with free pickup across India.",
      },
      { property: "og:url", content: "/returns" },
    ],
    links: [{ rel: "canonical", href: "/returns" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Returns."
      intro="15 days, no questions asked. If it doesn't fit your closet, send it back."
      sections={[
        {
          h: "Eligibility",
          body: "Unused, unwashed pieces with original tags within 15 days of delivery. Custom Studio pieces are non-returnable unless defective.",
        },
        {
          h: "How to start",
          body: "Open your order in Account → Orders, hit Return, pick a reason and a pickup slot. We collect from your doorstep — free across India.",
        },
        {
          h: "Refund timeline",
          body: "Refunds hit your original payment method within 5–7 business days of pickup. Store credit lands instantly.",
        },
        {
          h: "Exchanges",
          body: "Same product, different size or color — we ship the new piece the moment we pick the old one up. Zero downtime.",
        },
      ]}
    />
  ),
});
