import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CreditCard, Globe, Palette, Search, ShieldCheck, Store, Truck } from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SettingsPage,
});

const TABS = [
  { id: "branding", label: "Branding", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "seo", label: "SEO", icon: Search },
  { id: "theme", label: "Theme", icon: Store },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "domain", label: "Domain", icon: Globe },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("branding");
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Settings"
        description="Configure branding, fulfillment, payments, SEO, and team access."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="border border-line bg-paper p-1" aria-label="Settings sections">
          <ul>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setTab(t.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-[12px] uppercase tracking-[0.18em] transition ${active ? "bg-ink text-paper" : "text-mute hover:bg-fog hover:text-ink"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4">
          {tab === "branding" && <BrandingPanel />}
          {tab === "notifications" && <NotificationsPanel />}
          {tab === "shipping" && <ShippingPanel />}
          {tab === "payments" && <PaymentsPanel />}
          {tab === "seo" && <SeoPanel />}
          {tab === "theme" && <ThemePanel />}
          {tab === "security" && <SecurityPanel />}
          {tab === "domain" && <DomainPanel />}
        </div>
      </div>
    </div>
  );
}

function BrandingPanel() {
  return (
    <Panel title="Brand identity">
      <div className="space-y-5">
        <Row label="Brand name" hint="Used in emails, invoices and meta tags.">
          <input
            defaultValue="Ink Studio"
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
        <Row label="Logo">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center bg-ink font-display text-paper">
              I
            </div>
            <button className="border border-line bg-paper px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
              Upload
            </button>
          </div>
        </Row>
        <Row label="Primary palette" hint="Paper · Ink — the editorial duo.">
          <div className="flex gap-2">
            {["#f5f3ee", "#e8e4dd", "#0d0d0d", "#c0392b"].map((c) => (
              <div key={c} className="flex flex-col items-center">
                <span className="h-10 w-10 border border-line" style={{ background: c }} />
                <span className="mt-1 font-mono text-[10px] text-mute">{c}</span>
              </div>
            ))}
          </div>
        </Row>
        <Row label="Tagline">
          <input
            defaultValue="Heavyweight cotton, custom prints, anime drops."
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
      </div>
    </Panel>
  );
}

function NotificationsPanel() {
  return (
    <Panel title="Notification preferences">
      <div className="space-y-3">
        {[
          { label: "New orders", on: true, hint: "Email + push for every new order." },
          { label: "Low stock alerts", on: true, hint: "When inventory drops below threshold." },
          { label: "Studio requests", on: true, hint: "VIP and rush priority only." },
          { label: "Refund requests", on: true },
          { label: "Daily digest", on: false, hint: "9am IST summary email." },
          { label: "Weekly performance", on: true },
        ].map((n) => (
          <ToggleRow key={n.label} {...n} />
        ))}
      </div>
    </Panel>
  );
}

function ShippingPanel() {
  return (
    <Panel title="Shipping zones & rates">
      <div className="space-y-2">
        {[
          { zone: "India · Standard", rate: "Free over ₹999 · ₹49 below", days: "3–5 days" },
          { zone: "India · Express", rate: "₹149 flat", days: "1–2 days" },
          { zone: "International · Asia", rate: "₹899 flat", days: "7–10 days" },
          { zone: "International · Worldwide", rate: "₹1,499 flat", days: "10–14 days" },
        ].map((z) => (
          <div
            key={z.zone}
            className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 border border-line bg-paper px-4 py-3 text-[13px]"
          >
            <p className="text-ink">{z.zone}</p>
            <p className="text-mute">{z.rate}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{z.days}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PaymentsPanel() {
  return (
    <Panel title="Payment methods">
      <div className="space-y-3">
        {[
          { label: "UPI · Razorpay", on: true, hint: "Google Pay, PhonePe, Paytm" },
          { label: "Credit / Debit Cards", on: true, hint: "Visa, Mastercard, RuPay, Amex" },
          { label: "Cash on Delivery", on: true, hint: "Available within India" },
          { label: "Stripe (international)", on: false, hint: "Multi-currency, cards" },
          { label: "Apple Pay", on: false },
        ].map((p) => (
          <ToggleRow key={p.label} {...p} />
        ))}
      </div>
    </Panel>
  );
}

function SeoPanel() {
  return (
    <Panel title="SEO defaults">
      <div className="space-y-4">
        <Row label="Meta title template" hint="Use {page} for the route title.">
          <input
            defaultValue="{page} — Ink Studio"
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
        <Row label="Default description">
          <textarea
            rows={2}
            defaultValue="Heavyweight cotton, custom prints, and editorial anime drops from the Ink Studio."
            className="w-full resize-none border border-line bg-paper p-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
        <Row label="Sitemap">
          <p className="text-[12px] text-mute">
            Auto-generated. <span className="text-ink underline">/sitemap.xml</span>
          </p>
        </Row>
        <Row label="Robots.txt">
          <p className="text-[12px] text-mute">
            Allow all crawlers · Disallow <span className="font-mono">/admin</span>
          </p>
        </Row>
      </div>
    </Panel>
  );
}

function ThemePanel() {
  return (
    <Panel title="Theme customization">
      <div className="space-y-4">
        <Row label="Aesthetic" hint="Editorial paper-and-ink identity.">
          <div className="inline-flex border border-line">
            <button className="bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-paper">
              Paper & Ink
            </button>
            <button className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute">
              Monochrome
            </button>
            <button className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute">
              High-contrast
            </button>
          </div>
        </Row>
        <Row label="Typography" hint="Display / body pair.">
          <p className="text-[13px]">Editorial Serif × IBM Plex Sans</p>
        </Row>
        <Row label="Motion intensity">
          <input type="range" min={0} max={3} defaultValue={2} className="w-full accent-ink" />
        </Row>
      </div>
    </Panel>
  );
}

function SecurityPanel() {
  return (
    <Panel title="Security & access">
      <div className="space-y-3">
        <ToggleRow label="Two-factor authentication" on={true} hint="Required for all admins." />
        <ToggleRow
          label="Session timeout"
          on={true}
          hint="Auto sign-out after 8 hours of inactivity."
        />
        <ToggleRow label="Audit log" on={true} hint="Records all admin actions." />
      </div>
    </Panel>
  );
}

function DomainPanel() {
  return (
    <Panel title="Domain">
      <div className="space-y-3 text-[13px]">
        <p>
          Primary domain: <span className="font-mono text-ink">inkstudio.cc</span>{" "}
          <span className="ml-2 inline-flex items-center gap-1 border border-ink/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            <ShieldCheck className="h-3 w-3" /> SSL active
          </span>
        </p>
        <p className="text-mute">Redirects: 12 active · last edited 2 days ago</p>
        <button className="mt-2 border border-line bg-paper px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
          Add domain
        </button>
      </div>
    </Panel>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line/60 pb-4 last:border-0 last:pb-0 md:grid-cols-[200px_1fr]">
      <div>
        <p className="text-[12px] text-ink">{label}</p>
        {hint && <p className="text-[11px] text-mute">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({ label, on, hint }: { label: string; on: boolean; hint?: string }) {
  const [v, setV] = useState(on);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <div>
        <p className="text-[13px] text-ink">{label}</p>
        {hint && <p className="text-[11px] text-mute">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={v}
        onClick={() => setV(!v)}
        className={`relative mt-1 h-5 w-9 rounded-full transition ${v ? "bg-ink" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${v ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
