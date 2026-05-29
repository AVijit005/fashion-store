import { Link } from "@tanstack/react-router";
import { Check, Instagram, Twitter, Youtube } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Please enter a valid email").max(255);

const columns = [
  {
    title: "Shop",
    links: [
      { l: "New arrivals", to: "/new-arrivals" },
      { l: "Trending", to: "/trending" },
      { l: "Anime", to: "/anime-universe" },
      { l: "Drops", to: "/drops" },
      { l: "Outfits", to: "/outfits" },
      { l: "Sale", to: "/sale" },
    ],
  },
  {
    title: "Studio",
    links: [
      { l: "Custom prints", to: "/studio" },
      { l: "Lookbook", to: "/lookbook" },
      { l: "Creators", to: "/creators" },
      { l: "Gift guide", to: "/gift-guide" },
    ],
  },
  {
    title: "Help",
    links: [
      { l: "Help center", to: "/help-center" },
      { l: "Shipping", to: "/shipping" },
      { l: "Returns", to: "/returns" },
      { l: "Track order", to: "/account" },
      { l: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { l: "About", to: "/about" },
      { l: "Stores", to: "/stores" },
      { l: "Membership", to: "/membership" },
      { l: "Studio notes", to: "/blog" },
      { l: "Privacy", to: "/privacy" },
      { l: "Terms", to: "/terms" },
    ],
  },
] as const;

export function Footer() {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setError(null);
    setStatus("submitting");
    setTimeout(() => setStatus("success"), 600);
  };

  return (
    <footer className="mt-32 border-t border-line bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 lg:px-10">
        <div className="grid gap-16 py-20 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <p className="font-display text-5xl leading-[0.95] lg:text-7xl">
              Made for the
              <br />
              <span className="italic">next</span> generation.
            </p>
            <p className="mt-6 max-w-md text-sm text-mute">
              Heavyweight cotton, editorial prints, and a print studio for one-of-one pieces. Built
              in small batches, shipped worldwide.
            </p>
            {status === "success" ? (
              <p className="mt-8 flex max-w-md items-center gap-2 border-b border-ink/40 pb-3 text-[13px] text-ink">
                <Check className="h-4 w-4" aria-hidden="true" />
                You're on the list. Check your inbox.
              </p>
            ) : (
              <form
                noValidate
                className="mt-8 max-w-md"
                onSubmit={onSubmit}
                aria-label="Newsletter signup"
              >
                <div
                  className={`flex items-end gap-3 border-b pb-2 transition ${error ? "border-ink" : "border-ink"}`}
                >
                  <label htmlFor={inputId} className="sr-only">
                    Email address
                  </label>
                  <input
                    id={inputId}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    placeholder="your@email.com"
                    disabled={status === "submitting"}
                    className="w-full bg-transparent py-2 outline-none placeholder:text-mute/60 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="press text-[12px] uppercase tracking-[0.2em] disabled:opacity-60"
                  >
                    {status === "submitting" ? "Joining…" : "Join →"}
                  </button>
                </div>
                {error && (
                  <p
                    id={errorId}
                    role="alert"
                    className="mt-2 text-[11px] uppercase tracking-[0.18em] text-mute"
                  >
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title}>
                <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">{c.title}</p>
                <ul className="space-y-2">
                  {c.links.map((l) => (
                    <li key={l.l}>
                      <Link to={l.to} className="text-[14px] text-ink/80 hover:text-ink">
                        {l.l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-line py-6 md:flex-row md:items-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
            © 2026 Ink Studio. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a className="text-mute hover:text-ink" aria-label="Instagram">
              <Instagram className="h-4 w-4" />
            </a>
            <a className="text-mute hover:text-ink" aria-label="Twitter">
              <Twitter className="h-4 w-4" />
            </a>
            <a className="text-mute hover:text-ink" aria-label="YouTube">
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>

        <p className="select-none pb-2 text-center font-display text-[18vw] leading-none text-ink/[0.04] md:text-[14vw]">
          INK·STUDIO
        </p>
      </div>
    </footer>
  );
}
