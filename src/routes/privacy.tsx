import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "./shipping";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ink Studio" },
      {
        name: "description",
        content: "How Ink Studio collects, uses, and protects your information.",
      },
      { property: "og:title", content: "Privacy Policy — Ink Studio" },
      { property: "og:description", content: "How we collect, use, and protect your data." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Legal"
      title="Privacy."
      intro="Plain English. We only collect what we need to ship your order and make the experience better."
      sections={[
        {
          h: "What we collect",
          body: "Name, email, phone, shipping address, and payment metadata (never raw card numbers). Browsing data via cookies for analytics and personalization.",
        },
        {
          h: "How we use it",
          body: "To process orders, send shipping updates, recommend pieces, and respond when you contact us. We never sell your data.",
        },
        {
          h: "Third parties",
          body: "We share data with shipping partners, payment processors, and analytics providers under strict data-protection agreements.",
        },
        {
          h: "Your rights",
          body: "Request a copy, deletion, or correction of your data any time at privacy@inkstudio.app. We respond within 7 days.",
        },
      ]}
    />
  ),
});
