import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone, Instagram } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Ink Studio" },
      {
        name: "description",
        content: "Reach the Ink Studio team — email, WhatsApp, or Instagram DMs.",
      },
      { property: "og:title", content: "Contact — Ink Studio" },
      { property: "og:description", content: "We reply within a few hours, every day." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const channels = [
  { icon: Mail, label: "Email", value: "hello@inkstudio.app", href: "mailto:hello@inkstudio.app" },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+91 98765 43210",
    href: "https://wa.me/919876543210",
  },
  { icon: Phone, label: "Call", value: "Mon–Sat · 10am–7pm IST", href: "tel:+919876543210" },
  { icon: Instagram, label: "DMs", value: "@inkstudio", href: "https://instagram.com" },
];

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80, "Name is too long"),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z
    .string()
    .trim()
    .min(10, "Message should be at least 10 characters")
    .max(1000, "Message is too long"),
});

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

function ContactPage() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      message: fd.get("message"),
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    // Backend wiring left to the user — frontend-only for now.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    toast.success("Message sent. We'll reply within a few hours.");
    (e.target as HTMLFormElement).reset();
  };

  const fieldClass = (k: keyof FieldErrors) =>
    `w-full border bg-transparent px-3 py-3 outline-none transition ${
      errors[k] ? "border-accent" : "border-line focus:border-ink"
    }`;

  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Contact</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[8vw]">
          Talk to <span className="italic">us.</span>
        </h1>
        <p className="mt-6 max-w-xl text-mute">
          Anything about a drop, an order, a collab, or a wild idea — we read every message and
          reply fast.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 pb-32 lg:grid-cols-2 lg:px-10">
        <div className="space-y-3">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="flex items-center gap-4 border border-line bg-paper p-5 transition hover:border-ink"
            >
              <c.icon className="h-5 w-5" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{c.label}</p>
                <p className="mt-0.5">{c.value}</p>
              </div>
            </a>
          ))}
        </div>

        <form className="border border-line bg-paper p-6" onSubmit={onSubmit} noValidate>
          <p className="font-display text-2xl">Send a message</p>
          <div className="mt-5 space-y-3">
            <div>
              <label htmlFor="contact-name" className="sr-only">
                Your name
              </label>
              <input
                id="contact-name"
                name="name"
                placeholder="Your name"
                maxLength={80}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "contact-name-error" : undefined}
                className={fieldClass("name")}
              />
              {errors.name && (
                <p id="contact-name-error" className="mt-1 text-[12px] text-accent">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="contact-email" className="sr-only">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                placeholder="Email"
                maxLength={255}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                className={fieldClass("email")}
              />
              {errors.email && (
                <p id="contact-email-error" className="mt-1 text-[12px] text-accent">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="contact-message" className="sr-only">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                placeholder="What's on your mind?"
                rows={5}
                maxLength={1000}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                className={fieldClass("message")}
              />
              {errors.message && (
                <p id="contact-message-error" className="mt-1 text-[12px] text-accent">
                  {errors.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
