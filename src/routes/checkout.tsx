import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronRight,
  Lock,
  Smartphone,
  CreditCard,
  Banknote,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useCart } from "@/lib/store/cart";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { getOrCreateCartSessionId } from "@/lib/api/cart";
import { inr } from "@/lib/format";

// ---------------------------------------------------------------------------
// Razorpay SDK type declaration
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Ink Studio" },
      { name: "description", content: "Secure checkout." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STEPS = ["Address", "Shipping", "Payment"] as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{7,15}$/, "Enter a valid phone"),
  email: z.string().trim().email("Enter a valid email").max(255),
  line1: z.string().trim().min(3, "Address is required").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Required").max(60),
  state: z.string().trim().min(2, "Required").max(60),
  pin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "6-digit PIN"),
});

type Address = z.infer<typeof addressSchema>;
type Errors = Partial<Record<keyof Address, string>>;

const EMPTY: Address = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pin: "",
};

// ---------------------------------------------------------------------------
// Checkout API response type
// ---------------------------------------------------------------------------
interface CheckoutResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  guestToken: string | null;
}

// ---------------------------------------------------------------------------
// Razorpay SDK loader — idempotent, only loads once per page session
// ---------------------------------------------------------------------------
function useRazorpayScript() {
  useEffect(() => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.head.appendChild(script);
    // No cleanup — we want the SDK to persist across navigations
  }, []);
}

// ---------------------------------------------------------------------------
// CheckoutPage
// ---------------------------------------------------------------------------
function CheckoutPage() {
  useRazorpayScript();

  const navigate = useNavigate();
  const { items, subtotal, savings, clear } = useCart();

  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("standard");
  const [pay, setPay] = useState("upi");
  const [addr, setAddr] = useState<Address>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{code: string, discount: number} | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const sub = subtotal();
  const ship = sub > 999 || sub === 0 ? 0 : 79;
  const total = sub + ship - (appliedCoupon?.discount || 0);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError("");
    try {
      const res = await apiClient.post<{code: string, discount: number}>("/orders/apply-coupon", {
        code: couponCode,
        subtotal: sub,
      });
      setAppliedCoupon(res);
      setCouponCode("");
    } catch (e: any) {
      let msg = e.message || "Invalid coupon";
      if (msg.includes("P2002") || msg.toLowerCase().includes("internal server") || msg.includes("unexpected")) {
        msg = "An unexpected error occurred while processing your request. Please try again.";
      }
      setCouponError(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const setField = (k: keyof Address) => (v: string) => {
    setAddr((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const advance = () => {
    if (step === 0) {
      const parsed = addressSchema.safeParse(addr);
      if (!parsed.success) {
        const next: Errors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof Address;
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }
    }
    setStep(step + 1);
    setOrderError(null);
  };

  // -------------------------------------------------------------------------
  // Place Order — calls backend, then opens Razorpay modal
  // -------------------------------------------------------------------------
  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setOrderError(null);

    try {
      // Custom studio items are now handled dynamically via customData so they don't require variantId

      const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) ?? "";
      if (!/^rzp_(test|live)_/.test(razorpayKeyId) || razorpayKeyId.includes("placeholder")) {
        throw new Error("Payment is not configured for this deployment.");
      }

      const guestSessionId = getOrCreateCartSessionId() || undefined;

      // 1. Create order on backend (reserves inventory, creates Razorpay order)
      const checkoutRes = await apiClient.post<CheckoutResponse>("/orders/checkout", {
        shippingName: addr.name,
        shippingEmail: addr.email,
        shippingPhone: addr.phone,
        shippingStreet: addr.line1 + (addr.line2 ? `, ${addr.line2}` : ""),
        shippingCity: addr.city,
        shippingState: addr.state,
        shippingPostalCode: addr.pin,
        shippingCountry: "IN",
        guestSessionId,
        paymentMethod: pay,
        idempotencyKey,
        couponCode: appliedCoupon?.code,
      });

      // Persist guest token so order confirmation page can look up the order
      if (checkoutRes.guestToken && typeof window !== "undefined") {
        localStorage.setItem("ink_order_guest_token", checkoutRes.guestToken);
      }

      if (pay === "cod") {
        clear();
        await navigate({
          to: "/checkout/success",
          search: { orderId: checkoutRes.orderId, cod: true },
        });
        return;
      }

      // -----------------------------------------------------------------------
      // Production flow — open Razorpay modal
      // -----------------------------------------------------------------------
      if (typeof window === "undefined" || !window.Razorpay) {
        throw new Error("Payment SDK failed to load. Please refresh and try again.");
      }

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        amount: Math.round(checkoutRes.amount * 100), // backend returns ₹, Razorpay needs paise
        currency: checkoutRes.currency,
        order_id: checkoutRes.razorpayOrderId,
        name: "Ink Studio",
        description: `Order ${checkoutRes.orderId}`,
        prefill: {
          name: addr.name,
          email: addr.email,
          contact: addr.phone,
        },
        theme: { color: "#0d0d0d" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 2. Verify payment signature on backend
            await apiClient.post("/orders/verify-payment", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            // 3. Clear local + backend cart only after confirmed payment
            clear();

            // 4. Navigate to success
                setTimeout(() => {
                  navigate({ to: "/checkout/success", search: { orderId: checkoutRes.orderId, cod: false } });
                }, 1000);
          } catch (err) {
            toast.error("Payment failed. Please try a different card, UPI app, or select Cash on Delivery.");
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            setOrderError(
              "Payment was cancelled. Your cart is saved — complete payment when ready.",
            );
          },
        },
      });

      rzp.open();
    } catch (err: any) {
      let msg = err.message || "Failed to initiate payment";
      if (msg.includes("P2002") || msg.toLowerCase().includes("internal server") || msg.includes("unexpected")) {
        msg = "An unexpected error occurred while processing your request. Please try again.";
      }
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Empty cart guard
  // -------------------------------------------------------------------------
  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Checkout</p>
        <h1 className="mt-2 font-display text-5xl">Your bag is empty.</h1>
        <p className="mt-2 text-mute">Add a piece before checking out.</p>
        <Link
          to="/shop"
          className="mt-6 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          Shop
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-12 px-5 py-12 lg:grid-cols-[1fr_400px] lg:gap-16 lg:px-10 lg:py-16">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Checkout</p>
        <h1 className="mt-2 font-display text-5xl">Almost yours.</h1>

        {/* Stepper */}
        <ol className="mt-8 flex flex-wrap items-center justify-center sm:justify-start gap-4" aria-label="Checkout steps">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s} className="flex items-center gap-3">
                <button
                  onClick={() => i < step && setStep(i)}
                  aria-label={`Step ${i + 1}: ${s}`}
                  aria-current={current ? "step" : undefined}
                  className={`focus-ink press flex h-8 w-8 items-center justify-center border text-[12px] tabular-nums transition ${current || done ? "border-ink bg-ink text-paper" : "border-line text-mute"}`}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                </button>
                <span
                  className={`text-[12px] uppercase tracking-[0.18em] ${current ? "text-ink" : "text-mute"}`}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-mute" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-10 min-h-[400px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.form
                key="addr"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  advance();
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
                aria-label="Shipping address"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Full name"
                    autoComplete="name"
                    value={addr.name}
                    onChange={setField("name")}
                    error={errors.name}
                    placeholder="Arjun Kumar"
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addr.phone}
                    onChange={setField("phone")}
                    error={errors.phone}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <Field
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={addr.email}
                  onChange={setField("email")}
                  error={errors.email}
                  placeholder="you@email.com"
                />
                <Field
                  label="Address line 1"
                  autoComplete="address-line1"
                  value={addr.line1}
                  onChange={setField("line1")}
                  error={errors.line1}
                  placeholder="Flat / Door / Building"
                />
                <Field
                  label="Address line 2"
                  autoComplete="address-line2"
                  value={addr.line2 ?? ""}
                  onChange={setField("line2")}
                  error={errors.line2}
                  placeholder="Street, area (optional)"
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Field
                    label="City"
                    autoComplete="address-level2"
                    value={addr.city}
                    onChange={setField("city")}
                    error={errors.city}
                    placeholder="Mumbai"
                  />
                  <Field
                    label="State"
                    autoComplete="address-level1"
                    value={addr.state}
                    onChange={setField("state")}
                    error={errors.state}
                    placeholder="Maharashtra"
                  />
                  <Field
                    label="PIN code"
                    autoComplete="postal-code"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addr.pin}
                    onChange={setField("pin")}
                    error={errors.pin}
                    placeholder="400001"
                  />
                </div>
                {/* hidden submit allows Enter-to-advance */}
                <button type="submit" className="sr-only">
                  Continue
                </button>
              </motion.form>
            )}
            {step === 1 && (
              <motion.div
                key="ship"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
                role="radiogroup"
                aria-label="Shipping method"
              >
                {[{ id: "standard", t: "Standard (India Only)", d: "3–5 business days", p: subtotal > 999 ? 0 : 79 }].map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center justify-between gap-4 border p-5 transition ${shipping === o.id ? "border-ink" : "border-line hover:border-graphite"}`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${shipping === o.id ? "border-ink" : "border-line"}`}
                      >
                        {shipping === o.id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                      </span>
                      <div>
                        <p className="font-medium">{o.t}</p>
                        <p className="text-[12px] text-mute">{o.d}</p>
                      </div>
                    </div>
                    <p className="tabular-nums">{o.p === 0 ? "Free" : inr(o.p)}</p>
                    <input
                      type="radio"
                      name="ship"
                      checked={shipping === o.id}
                      onChange={() => setShipping(o.id)}
                      className="sr-only"
                      aria-label={`${o.t}, ${o.d}`}
                    />
                  </label>
                ))}
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="pay"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
                role="radiogroup"
                aria-label="Payment method"
              >
                {[
                  { id: "upi", t: "UPI", d: "Google Pay, PhonePe, Paytm", icon: Smartphone },
                  {
                    id: "card",
                    t: "Credit / Debit Card",
                    d: "Visa, Mastercard, RuPay",
                    icon: CreditCard,
                  },
                  { id: "cod", t: "Cash on Delivery", d: "Pay when it arrives", icon: Banknote },
                ].map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-4 border p-5 transition ${pay === o.id ? "border-ink" : "border-line hover:border-graphite"}`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${pay === o.id ? "border-ink" : "border-line"}`}
                    >
                      {pay === o.id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                    </span>
                    <o.icon className="h-5 w-5" aria-hidden="true" />
                    <div className="flex-1">
                      <p className="font-medium">{o.t}</p>
                      <p className="text-[12px] text-mute">{o.d}</p>
                    </div>
                    <input
                      type="radio"
                      name="pay"
                      checked={pay === o.id}
                      onChange={() => setPay(o.id)}
                      className="sr-only"
                      aria-label={`${o.t}, ${o.d}`}
                    />
                  </label>
                ))}
                <p className="mt-3 flex items-center gap-2 text-[12px] text-mute">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Encrypted, PCI-DSS compliant.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error banner */}
        {orderError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 border border-ink/20 bg-ink/5 px-4 py-3 text-[13px]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <span>{orderError}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10">
          {step < 2 ? (
             <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0 || isSubmitting}
                className="press text-[12px] uppercase tracking-[0.22em] text-mute disabled:opacity-30"
              >
                ← Back
              </button>
              <button
                onClick={advance}
                className="press bg-ink px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
              >
                Continue →
              </button>
             </div>
          ) : (
            <button
              id="place-order-btn"
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              className="mt-6 w-full bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition-all hover:bg-graphite disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent" />
                  {pay === "cod" ? "Processing..." : "Opening secure payment..."}
                </>
              ) : (
                <>Place order · {inr(total)}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Order summary sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
        <div className="border border-line bg-paper">
          <div className="border-b border-line p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Order summary</p>
            <p className="font-display text-2xl">
              {items.length} item{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="max-h-[260px] overflow-y-auto">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3 border-b border-line p-4">
                <img
                  src={it.image}
                  alt=""
                  width={56}
                  height={64}
                  className="h-16 w-14 object-cover"
                />
                <div className="flex-1 text-[13px]">
                  <p className="truncate">{it.name}</p>
                  <p className="text-[11px] text-mute">
                    {it.color} · {it.size} · ×{it.qty}
                  </p>
                </div>
                <p className="tabular-nums text-[13px]">{inr(it.price * it.qty)}</p>
              </li>
            ))}
          </ul>
          
          <div className="p-5 border-b border-line space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value); setCouponError(""); }}
                placeholder="Discount code"
                className="h-10 w-full border border-line bg-paper px-3 text-[12px] uppercase outline-none focus:border-ink"
                disabled={!!appliedCoupon}
              />
              <button
                onClick={applyCoupon}
                disabled={isApplyingCoupon || !!appliedCoupon || !couponCode}
                className="bg-ink px-4 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50 transition"
              >
                {isApplyingCoupon ? "..." : "Apply"}
              </button>
            </div>
            {couponError && <p className="text-[11px] text-accent">{couponError}</p>}
            {appliedCoupon && (
              <div className="flex items-center justify-between bg-fog/30 px-3 py-2 text-[12px]">
                <span className="font-mono text-ink tracking-[0.1em]">{appliedCoupon.code}</span>
                <button onClick={removeCoupon} className="text-mute hover:text-ink">✕</button>
              </div>
            )}
          </div>

          <dl className="space-y-1.5 p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-mute">Subtotal</dt>
              <dd className="tabular-nums">{inr(sub)}</dd>
            </div>
            {savings() > 0 && (
              <div className="flex justify-between text-accent">
                <dt>Savings</dt>
                <dd className="tabular-nums">−{inr(savings())}</dd>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between text-accent">
                <dt>Discount ({appliedCoupon.code})</dt>
                <dd className="tabular-nums">−{inr(appliedCoupon.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-mute">Shipping</dt>
              <dd className="tabular-nums">{ship === 0 ? "Free (India Only)" : inr(ship)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mute">GST</dt>
              <dd className="tabular-nums">Included</dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-mute">Total</dt>
              <dd className="font-display text-3xl tabular-nums">{inr(total)}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------
type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url" | "search" | "decimal";
  pattern?: string;
  required?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  autoComplete,
  inputMode,
  pattern,
  required,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-err`;
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[11px] uppercase tracking-[0.22em] text-mute">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 w-full border-b bg-transparent py-2 outline-none transition focus:border-ink ${error ? "border-ink" : "border-line"}`}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-mute"
        >
          {error}
        </span>
      )}
    </label>
  );
}
