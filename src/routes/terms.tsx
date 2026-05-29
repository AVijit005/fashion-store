import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "./shipping";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Ink Studio" },
      { name: "description", content: "The rules of using inkstudio.app." },
      { property: "og:title", content: "Terms of Service — Ink Studio" },
      { property: "og:description", content: "The rules of using inkstudio.app." },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Legal"
      title="Terms."
      intro="The basics, written like a human."
      sections={[
        {
          h: "Using the site",
          body: "Be cool. No scraping, no abuse, no impersonating Ink Studio. We can suspend accounts that break the rules.",
        },
        {
          h: "Orders",
          body: "An order is a binding contract once we send confirmation. We can cancel orders for fraud, pricing errors, or stockouts, with a full refund.",
        },
        {
          h: "Intellectual property",
          body: "All photography, designs, and copy belong to Ink Studio. Custom Studio uploads remain yours — you grant us a license to print them on your order.",
        },
        {
          h: "Limitation of liability",
          body: "We're responsible up to the value of your order. Beyond that, force-majeure events (couriers, customs, weather) are not on us.",
        },
      ]}
    />
  ),
});
