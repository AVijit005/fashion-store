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
import { apiClient } from "@/lib/api/client";
import { useAddresses, useDeleteAddress, useUpdatePreferences } from "@/lib/api/users";
import { AddressForm } from "@/components/account/address-form";
import { useAuthStore } from "@/lib/store/auth";
import { toast } from "sonner";

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
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const { data: addresses = [], isLoading: loadingAddresses } = useAddresses();
  const deleteAddress = useDeleteAddress();
  const updatePreferences = useUpdatePreferences();
  const { isAuthenticated, user, logout, setAuthModalOpen, isLoading } = useAuthStore();

  const prefs = (user as any)?.preferences || {};
  const notifs = prefs.notifications || {
    orderUpdates: true,
    dropAlerts: true,
    restocks: true,
    sales: false,
  };

  const handlePrefChange = (key: string, val: any) => {
    const newPrefs = { ...prefs, [key]: val };
    updatePreferences.mutate(newPrefs, {
      onSuccess: (updatedUser) => {
        useAuthStore.setState({ user: updatedUser });
        toast.success("Preferences updated");
      },
    });
  };

  const handleNotifChange = (key: string, checked: boolean) => {
    const newPrefs = { ...prefs, notifications: { ...notifs, [key]: checked } };
    updatePreferences.mutate(newPrefs, {
      onSuccess: (updatedUser) => {
        useAuthStore.setState({ user: updatedUser });
        toast.success("Notifications updated");
      },
    });
  };

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
          },
        },
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
            <p className="text-sm text-mute mt-1">
              Manage products, orders, customers, and site settings.
            </p>
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
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items?.length || 0} item
                      {(o.items?.length || 0) > 1 ? "s" : ""}
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
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                      Status details
                    </p>
                    <p className="mt-1 font-display text-2xl">{o.status.replace("_", " ")}</p>
                    {(o.status === "FAILED" || o.status === "PAYMENT_PENDING") &&
                      o.paymentProvider === "RAZORPAY" && (
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
                        const reachedIdx =
                          o.status === "DELIVERED"
                            ? trackingSteps.length - 1
                            : o.status === "SHIPPED"
                              ? 3
                              : o.status === "PROCESSING"
                                ? 2
                                : 1;
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
          {orders.filter((o) => o.status === "DELIVERED").length > 0 ? (
            <div className="grid gap-4">
              <p className="text-mute mb-2">Select a delivered order to initiate a return:</p>
              {orders
                .filter((o) => o.status === "DELIVERED")
                .map((o) => (
                  <div
                    key={o.id}
                    className="border border-line p-6 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium text-[14px]">
                        INK-{o.id.substring(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[12px] text-mute">
                        Delivered on {new Date(o.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        window.location.href = `mailto:support@inkstudio.com?subject=Return Request for Order INK-${o.id.substring(0, 8).toUpperCase()}&body=Please provide the reason for return:%0A%0A`;
                      }}
                      className="border border-line px-4 py-2 text-[12px] uppercase tracking-[0.18em] hover:border-ink hover:text-ink transition-colors"
                    >
                      Request Return
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="border border-line bg-paper p-8 text-center">
              <p className="font-display text-3xl">No eligible returns.</p>
              <p className="mt-2 text-mute">
                You can only return items from orders that have been delivered.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Addresses */}
        <TabsContent value="addresses" className="mt-8">
          {isAddingAddress ? (
            <div className="border border-line p-6 max-w-xl">
              <h3 className="font-display text-2xl mb-4">Add new address</h3>
              <AddressForm
                onCancel={() => setIsAddingAddress(false)}
                onSuccess={() => setIsAddingAddress(false)}
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {loadingAddresses ? (
                <div className="col-span-2 text-mute text-center py-10">Loading addresses...</div>
              ) : addresses.length === 0 ? (
                <div className="col-span-2 text-center py-10 border border-dashed border-line">
                  <p className="text-mute">You have no saved addresses.</p>
                </div>
              ) : (
                addresses.map((a) => (
                  <div key={a.id} className="border border-line p-6">
                    {a.isDefault && (
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mute mb-2">
                        Default
                      </p>
                    )}
                    <p className="font-medium">{a.street}</p>
                    <p className="mt-1 text-sm text-mute">
                      {a.city}, {a.state} {a.postalCode}
                    </p>
                    <p className="mt-1 text-sm text-mute">{a.country}</p>
                    <div className="mt-4 flex gap-3 text-[12px] uppercase tracking-[0.18em]">
                      <button
                        onClick={() => deleteAddress.mutate(a.id)}
                        className="text-mute hover:text-red-500 transition-colors"
                        disabled={deleteAddress.isPending}
                      >
                        {deleteAddress.isPending ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))
              )}
              {!isAddingAddress && (
                <button
                  onClick={() => setIsAddingAddress(true)}
                  className="flex min-h-[160px] items-center justify-center border border-dashed border-line text-[12px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink transition-colors"
                >
                  + Add address
                </button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-8">
          <div className="border border-line p-10 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-mute mb-4" />
            <p className="font-display text-2xl">No saved payments</p>
            <p className="mt-2 text-mute max-w-sm mx-auto">
              Your securely saved cards and payment methods will appear here after your next
              checkout.
            </p>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-8">
          <ul className="divide-y divide-line border-y border-line">
            {[
              { id: "orderUpdates", t: "Order updates", d: "Shipping, tracking and delivery." },
              { id: "dropAlerts", t: "Drop alerts", d: "Be first to know when a drop goes live." },
              { id: "restocks", t: "Restocks", d: "Get pinged when something you saved is back." },
              { id: "sales", t: "Sale & offers", d: "Quarterly only. No spam." },
            ].map(({ id, t, d }) => (
              <li key={id} className="flex items-center justify-between py-5">
                <div>
                  <p>{t}</p>
                  <p className="text-[12px] text-mute">{d}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifs[id as keyof typeof notifs] ?? false}
                  onChange={(e) => handleNotifChange(id, e.target.checked)}
                  className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-ink relative before:absolute before:inset-y-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-paper before:transition-transform checked:before:translate-x-4"
                />
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-8">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { key: "language", l: "Language", v: ["English", "हिंदी"] },
              { key: "currency", l: "Currency", v: ["INR ₹", "USD $", "EUR €"] },
              { key: "defaultSize", l: "Default size", v: ["S", "M", "L", "XL"] },
              { key: "fit", l: "Fit", v: ["Regular", "Oversized"] },
            ].map((p) => (
              <div key={p.l}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{p.l}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.v.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handlePrefChange(p.key, opt)}
                      className={`border px-4 py-2 text-[12px] uppercase tracking-[0.18em] transition-colors ${prefs[p.key] === opt || (!prefs[p.key] && p.v[0] === opt) ? "border-ink bg-ink text-paper" : "border-line hover:border-graphite"}`}
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
