import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Package,
  Heart,
  MapPin,
  CreditCard,
  LogOut,
  Bell,
  Settings,
  RotateCcw,
  Check,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/store/auth";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Ink Studio" },
      { name: "description", content: "Your orders, addresses, payments, and preferences." },
    ],
  }),
  component: Account,
});

// Fetch real orders now

const trackingSteps = [
  "Order placed",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

function Account() {
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const { isAuthenticated, user, logout, setAuthModalOpen, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setAuthModalOpen(true);
    } else if (isAuthenticated) {
      fetchOrders();
    }
  }, [isLoading, isAuthenticated, setAuthModalOpen]);

  const fetchOrders = async () => {
    try {
      const data = await apiClient.get<any[]>("/orders/me");
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders", err);
    }
  };

  const handleRetryPayment = async (orderId: string) => {
    if (isRetrying) return;
    setIsRetrying(orderId);
    try {
      const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) ?? "";
      const res = await apiClient.post<any>(`/orders/${orderId}/retry-payment`, {});
      
      if (!window.Razorpay) throw new Error("Payment SDK failed to load");

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        amount: Math.round(res.amount * 100),
        currency: res.currency,
        order_id: res.razorpayOrderId,
        name: "Ink Studio",
        description: `Order ${res.orderId}`,
        prefill: { email: user?.email },
        theme: { color: "#0d0d0d" },
        handler: async (response: any) => {
          try {
            await apiClient.post("/orders/verify-payment", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment successful!");
            fetchOrders();
          } catch (err) {
            toast.error("Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setIsRetrying(null);
            toast.info("Payment retry cancelled.");
          }
        }
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Failed to retry payment");
      setIsRetrying(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-paper">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink border-t-transparent mx-auto"></div>
          <p className="mt-4 text-mute uppercase tracking-widest text-[11px]">Loading Account...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[1480px] px-5 py-24 lg:px-10 lg:py-32 text-center bg-paper flex flex-col items-center justify-center">
        <p className="font-display text-4xl">Sign In to View Account</p>
        <p className="mt-2 text-mute max-w-sm">
          Please sign in to access your order history and account preferences.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const username = user?.email.split("@")[0] || "Customer";

  return (
    <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Account</p>
      <h1 className="mt-2 font-display text-5xl lg:text-6xl capitalize">Hello, {username}.</h1>
      <p className="mt-2 text-mute">
        Registered email: {user?.email} · Account type: {user?.role}
      </p>

      {user?.role === "ADMIN" && (
        <div className="mt-8 border border-line bg-fog/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl">Admin Dashboard</p>
            <p className="text-sm text-mute mt-1">Manage products, orders, customers, and site settings.</p>
          </div>
          <Link
            to="/admin"
            className="shrink-0 bg-ink px-6 py-3 text-[12px] uppercase tracking-[0.22em] text-paper hover:bg-ink/90 transition-colors"
          >
            Open Dashboard →
          </Link>
        </div>
      )}

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList className="flex flex-wrap justify-start gap-1 bg-transparent p-0">
          {[
            { v: "orders", l: "Orders", i: Package },
            { v: "returns", l: "Returns", i: RotateCcw },
            { v: "addresses", l: "Addresses", i: MapPin },
            { v: "payment", l: "Payment", i: CreditCard },
            { v: "notifications", l: "Notifications", i: Bell },
            { v: "preferences", l: "Preferences", i: Settings },
            { v: "saved", l: "Saved", i: Heart },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="flex items-center gap-2 rounded-none border border-line bg-paper px-4 py-2 text-[12px] uppercase tracking-[0.18em] data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-paper"
            >
              <t.i className="h-4 w-4" />
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Orders */}
        <TabsContent value="orders" className="mt-8">
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.id} className="py-5">
                <button
                  onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-[14px]">INK-{o.id.substring(0, 8).toUpperCase()}</p>
                    <p className="text-[12px] text-mute">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items?.length || 0} item{(o.items?.length || 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p
                    className={`text-[12px] uppercase tracking-[0.18em] ${o.status === "DELIVERED" ? "text-mute" : o.status === "FAILED" ? "text-red-500" : "text-accent"}`}
                  >
                    {o.status.replace("_", " ")}
                  </p>
                  <p className="tabular-nums">₹{o.totalAmount}</p>
                  <span className="text-[12px] uppercase tracking-[0.18em] underline-offset-4 hover:underline">
                    {openOrder === o.id ? "Close" : "View →"}
                  </span>
                </button>
                {openOrder === o.id && (
                  <div className="mt-6 border border-line bg-fog/40 p-6">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Status details</p>
                    <p className="mt-1 font-display text-2xl">{o.status.replace("_", " ")}</p>
                    {(o.status === "FAILED" || o.status === "PAYMENT_PENDING") && o.paymentProvider === "RAZORPAY" && (
                      <button 
                        onClick={() => handleRetryPayment(o.id)}
                        disabled={isRetrying === o.id}
                        className="mt-4 bg-ink text-paper px-6 py-3 text-[12px] uppercase tracking-[0.22em] hover:bg-ink/90 disabled:opacity-50"
                      >
                        {isRetrying === o.id ? "Processing..." : "Retry Payment"}
                      </button>
                    )}
                    <ol className="mt-6 space-y-3">
                      {trackingSteps.map((s, i) => {
                        const reachedIdx = o.status === "DELIVERED" ? trackingSteps.length - 1 : 
                                         (o.status === "SHIPPED" ? 3 : 
                                         (o.status === "PROCESSING" ? 2 : 1));
                        const done = i <= reachedIdx;
                        return (
                          <li key={s} className="flex items-center gap-3">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? "border-ink bg-ink text-paper" : "border-line text-mute"}`}
                            >
                              {done && <Check className="h-3 w-3" />}
                            </span>
                            <span className={done ? "" : "text-mute"}>{s}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* Returns */}
        <TabsContent value="returns" className="mt-8">
          <div className="border border-line bg-paper p-8 text-center">
            <p className="font-display text-3xl">No active returns.</p>
            <p className="mt-2 text-mute">
              Start one from any delivered order in three quick steps.
            </p>
            <ol className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-4 text-left text-[12px]">
              {["1. Select item", "2. Reason & pickup", "3. Refund confirmed"].map((s) => (
                <li key={s} className="border border-line p-4 uppercase tracking-[0.18em]">
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        {/* Addresses */}
        <TabsContent value="addresses" className="mt-8">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                tag: "Home",
                name: "Arjun Mehta",
                addr: "B-204, Skyline Heights, Bandra West, Mumbai 400050",
                phone: "+91 98765 43210",
              },
              {
                tag: "Office",
                name: "Arjun Mehta",
                addr: "Floor 7, BKC One, Bandra Kurla Complex, Mumbai 400051",
                phone: "+91 98765 43210",
              },
            ].map((a) => (
              <div key={a.tag} className="border border-line p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{a.tag}</p>
                <p className="mt-2 font-medium">{a.name}</p>
                <p className="mt-1 text-sm text-mute">{a.addr}</p>
                <p className="mt-1 text-sm text-mute">{a.phone}</p>
                <div className="mt-4 flex gap-3 text-[12px] uppercase tracking-[0.18em]">
                  <button className="underline-offset-4 hover:underline">Edit</button>
                  <button className="text-mute hover:text-ink">Remove</button>
                </div>
              </div>
            ))}
            <button className="flex min-h-[160px] items-center justify-center border border-dashed border-line text-[12px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
              + Add address
            </button>
          </div>
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-8">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { l: "HDFC Debit", v: "•••• 4221", e: "08/27" },
              { l: "UPI", v: "arjun@ybl", e: "Verified" },
            ].map((c) => (
              <div key={c.v} className="border border-line p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{c.l}</p>
                <p className="mt-2 font-display text-2xl tracking-widest">{c.v}</p>
                <p className="mt-1 text-[12px] text-mute">{c.e}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-8">
          <ul className="divide-y divide-line border-y border-line">
            {[
              ["Order updates", "Shipping, tracking and delivery."],
              ["Drop alerts", "Be first to know when a drop goes live."],
              ["Restocks", "Get pinged when something you saved is back."],
              ["Sale & offers", "Quarterly only. No spam."],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-center justify-between py-5">
                <div>
                  <p>{t}</p>
                  <p className="text-[12px] text-mute">{d}</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked={i < 3}
                  className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-ink"
                />
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-8">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { l: "Language", v: ["English", "हिंदी"] },
              { l: "Currency", v: ["INR ₹", "USD $", "EUR €"] },
              { l: "Default size", v: ["S", "M", "L", "XL"] },
              { l: "Fit", v: ["Regular", "Oversized"] },
            ].map((p) => (
              <div key={p.l}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{p.l}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.v.map((opt, i) => (
                    <button
                      key={opt}
                      className={`border px-4 py-2 text-[12px] uppercase tracking-[0.18em] ${i === 0 ? "border-ink bg-ink text-paper" : "border-line"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-8">
          <p className="text-mute">
            Your saved pieces live in your{" "}
            <Link to="/wishlist" className="text-ink hover:underline">
              wishlist
            </Link>
            .
          </p>
        </TabsContent>
      </Tabs>

      <button
        onClick={async () => {
          await logout();
          toast.success("Signed out successfully.");
        }}
        className="mt-16 flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-mute hover:text-ink cursor-pointer"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
