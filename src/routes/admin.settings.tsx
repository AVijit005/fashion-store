import { createFileRoute } from "@tanstack/react-router";
import { useState, createContext, useContext, useEffect } from "react";
import { toast } from "sonner";
import { Bell, CreditCard, Globe, Palette, Search, ShieldCheck, Store, Truck } from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

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

const DEFAULT_SETTINGS = {
  brandName: "Ink Studio",
  tagline: "Heavyweight cotton, custom prints, anime drops.",
  notifications: {
    newOrders: true,
    lowStock: true,
    studioRequests: true,
    refundRequests: true,
    dailyDigest: false,
    weeklyPerformance: true,
  },
  shipping: [
    { zone: "India · Standard", rate: "Free over ₹999 · ₹49 below", days: "3–5 days" },
    { zone: "India · Express", rate: "₹149 flat", days: "1–2 days" },
    { zone: "International · Asia", rate: "₹899 flat", days: "7–10 days" },
    { zone: "International · Worldwide", rate: "₹1,499 flat", days: "10–14 days" },
  ],
  payments: [
    { id: "upi", label: "UPI · Razorpay", on: true, hint: "Google Pay, PhonePe, Paytm" },
    { id: "cards", label: "Credit / Debit Cards", on: true, hint: "Visa, Mastercard, RuPay, Amex" },
    { id: "cod", label: "Cash on Delivery", on: true, hint: "Available within India" },
    { id: "stripe", label: "Stripe (international)", on: false, hint: "Multi-currency, cards" },
    { id: "applePay", label: "Apple Pay", on: false },
  ],
  seo: {
    metaTitle: "{page} — Ink Studio",
    metaDesc: "Heavyweight cotton, custom prints, and editorial anime drops from the Ink Studio.",
  },
  theme: {
    aesthetic: "Paper & Ink",
    motionIntensity: 2,
  },
  security: {
    twoFactor: true,
    sessionTimeout: true,
    auditLog: true,
  },
};

const SettingsContext = createContext<
  [typeof DEFAULT_SETTINGS, React.Dispatch<React.SetStateAction<typeof DEFAULT_SETTINGS>>]
>([DEFAULT_SETTINGS, () => {}]);

function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("branding");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiClient.get("/admin/settings").catch((err) => {
      console.error("Failed to fetch settings:", err);
      toast.error("Failed to load settings from server. Using defaults.");
      return null;
    }),
  });

  useEffect(() => {
    if (serverSettings) {
      setSettings((prev) => ({ ...prev, ...serverSettings }));
    }
  }, [serverSettings]);

  const saveMutation = useMutation({
    mutationFn: (newSettings: typeof DEFAULT_SETTINGS) =>
      apiClient.put("/admin/settings", newSettings).catch((err) => {
        console.error("Failed to save settings:", err);
        throw err;
      }),
    onSuccess: () => {
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-96 animate-pulse rounded border border-line bg-fog/20" />
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={[settings, setSettings]}>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Workspace"
          title="Settings"
          description="Configure branding, fulfillment, payments, SEO, and team access."
          actions={
            <button
              onClick={() => saveMutation.mutate(settings)}
              disabled={saveMutation.isPending}
              className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save changes"}
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <nav
            className="hidden lg:block border border-line bg-paper p-1"
            aria-label="Settings sections"
          >
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

          <div className="block lg:hidden border border-line bg-paper px-3 py-2">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as (typeof TABS)[number]["id"])}
              className="w-full bg-transparent outline-none text-[12px] uppercase tracking-[0.18em] text-ink"
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

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
    </SettingsContext.Provider>
  );
}

function BrandingPanel() {
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="Brand identity">
      <div className="space-y-5">
        <Row label="Brand name" hint="Used in emails, invoices and meta tags.">
          <input
            value={settings.brandName}
            onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
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
            value={settings.tagline}
            onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
      </div>
    </Panel>
  );
}

function NotificationsPanel() {
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="Notification preferences">
      <div className="space-y-3">
        {[
          { key: "newOrders", label: "New orders", hint: "Email + push for every new order." },
          {
            key: "lowStock",
            label: "Low stock alerts",
            hint: "When inventory drops below threshold.",
          },
          { key: "studioRequests", label: "Studio requests", hint: "VIP and rush priority only." },
          { key: "refundRequests", label: "Refund requests" },
          { key: "dailyDigest", label: "Daily digest", hint: "9am IST summary email." },
          { key: "weeklyPerformance", label: "Weekly performance" },
        ].map((n) => (
          <ToggleRow
            key={n.label}
            label={n.label}
            hint={n.hint}
            on={settings.notifications[n.key as keyof typeof settings.notifications]}
            onChange={(v) =>
              setSettings({ ...settings, notifications: { ...settings.notifications, [n.key]: v } })
            }
          />
        ))}
      </div>
    </Panel>
  );
}

function ShippingPanel() {
  const [settings] = useContext(SettingsContext);
  return (
    <Panel title="Shipping zones & rates">
      <div className="space-y-2">
        {settings.shipping.map((z: (typeof DEFAULT_SETTINGS)["shipping"][number]) => (
          <div
            key={z.zone}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] items-center gap-4 border border-line bg-paper px-4 py-3 text-[13px]"
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
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="Payment methods">
      <div className="space-y-3">
        {settings.payments.map((p: (typeof DEFAULT_SETTINGS)["payments"][number], idx: number) => (
          <ToggleRow
            key={p.label}
            {...p}
            onChange={(v) => {
              const newPayments = [...settings.payments];
              newPayments[idx].on = v;
              setSettings({ ...settings, payments: newPayments });
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

function SeoPanel() {
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="SEO defaults">
      <div className="space-y-4">
        <Row label="Meta title template" hint="Use {page} for the route title.">
          <input
            value={settings.seo.metaTitle}
            onChange={(e) =>
              setSettings({ ...settings, seo: { ...settings.seo, metaTitle: e.target.value } })
            }
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
        <Row label="Default description">
          <textarea
            rows={2}
            value={settings.seo.metaDesc}
            onChange={(e) =>
              setSettings({ ...settings, seo: { ...settings.seo, metaDesc: e.target.value } })
            }
            className="w-full resize-none border border-line bg-paper p-3 text-[13px] outline-none focus:border-ink"
          />
        </Row>
        <Row label="Sitemap">
          <p className="text-[12px] text-mute">
            Auto-generated. <span className="text-ink underline">/sitemap.xml</span>
          </p>
        </Row>
      </div>
    </Panel>
  );
}

function ThemePanel() {
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="Storefront theme">
      <div className="space-y-5">
        <Row label="Active aesthetic">
          <select
            value={settings.theme.aesthetic}
            onChange={(e) =>
              setSettings({ ...settings, theme: { ...settings.theme, aesthetic: e.target.value } })
            }
            className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink"
          >
            <option>Paper & Ink</option>
            <option>Cyberpunk</option>
            <option>Minimalist</option>
          </select>
        </Row>
        <Row label="Motion intensity">
          <div className="flex gap-2">
            {[1, 2, 3].map((lvl) => (
              <button
                key={lvl}
                onClick={() =>
                  setSettings({ ...settings, theme: { ...settings.theme, motionIntensity: lvl } })
                }
                className={`flex h-9 flex-1 items-center justify-center border text-[12px] transition ${
                  settings.theme.motionIntensity === lvl
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-mute hover:border-ink"
                }`}
              >
                Level {lvl}
              </button>
            ))}
          </div>
        </Row>
      </div>
    </Panel>
  );
}

function SecurityPanel() {
  const [settings, setSettings] = useContext(SettingsContext);
  return (
    <Panel title="Security & access">
      <div className="space-y-3">
        <ToggleRow
          label="Two-factor authentication"
          on={settings.security.twoFactor}
          onChange={(v) =>
            setSettings({ ...settings, security: { ...settings.security, twoFactor: v } })
          }
          hint="Required for all admins."
        />
        <ToggleRow
          label="Session timeout"
          on={settings.security.sessionTimeout}
          onChange={(v) =>
            setSettings({ ...settings, security: { ...settings.security, sessionTimeout: v } })
          }
          hint="Auto sign-out after 8 hours of inactivity."
        />
        <ToggleRow
          label="Audit log"
          on={settings.security.auditLog}
          onChange={(v) =>
            setSettings({ ...settings, security: { ...settings.security, auditLog: v } })
          }
          hint="Records all admin actions."
        />
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

function ToggleRow({
  label,
  on,
  hint,
  onChange,
}: {
  label: string;
  on?: boolean;
  hint?: string;
  onChange?: (v: boolean) => void;
}) {
  const [internalV, setInternalV] = useState(on ?? false);
  const v = on !== undefined ? on : internalV;
  const handleChange = () => {
    if (onChange) onChange(!v);
    else setInternalV(!v);
  };
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
        onClick={handleChange}
        className={`relative mt-1 h-5 w-9 rounded-full transition ${v ? "bg-ink" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${v ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
