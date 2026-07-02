import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, AlertTriangle, Clock, RefreshCw, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : "",
    cod: search.cod === "true",
  }),
  head: () => ({
    meta: [{ title: "Order placed — Ink Studio" }],
  }),
  component: Success,
});

function Success() {
  const { orderId, cod } = Route.useSearch();
  const { isAuthenticated, setAuthModalOpen } = useAuthStore();

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("No order ID");
      const guestToken =
        typeof window !== "undefined" ? sessionStorage.getItem("ink_order_guest_token") : null;
      const order = await apiClient.get<{ paymentStatus: string }>(
        `/orders/${orderId}`,
        undefined,
        {
          headers: guestToken ? { "x-guest-token": guestToken } : undefined,
        },
      );
      return order;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
        <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-mute">
          Confirming your payment…
        </p>
        {orderId && (
          <p className="mt-2 text-[11px] text-mute">
            Order <span className="font-mono">#{orderId.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
      </div>
    );
  }

  // Phase 4 fix: never silently redirect to "/". The old behaviour bounced
  // users who paid but whose webhook hadn't landed yet (or whose order id
  // was malformed) — they had no idea whether money had left their account.
  // We now render explicit states: pending, error-with-retry, or success.

  // No order id at all → invalid URL, offer a safe landing page.
  if (!orderId) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-4xl">No order found</p>
        <p className="mt-3 text-mute">
          This page expects a valid order id. If you just completed checkout, your confirmation
          email will arrive shortly.
        </p>
        <Link
          to="/"
          className="mt-8 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          Back to home
        </Link>
      </div>
    );
  }

  // Network error fetching the order.
  if (isError || !order) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-accent" />
        <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-mute">
          We couldn't verify your order
        </p>
        <h1 className="mt-2 font-display text-4xl leading-[0.95]">
          If you were charged, don't worry.
        </h1>
        <p className="mt-4 text-mute">
          Your payment may have succeeded but our confirmation is taking longer than usual. Please
          don't try to pay again — you may be double-charged.
        </p>
        <p className="mt-6 font-mono text-[12px] text-ink">
          Order reference: #{orderId.slice(0, 8).toUpperCase()}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh status
          </button>
          <Link
            to="/contact"
            className="flex items-center justify-center gap-2 border border-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Contact support
          </Link>
        </div>
      </div>
    );
  }

  // Order fetched but payment still pending (webhook hasn't arrived).
  if (
    order.paymentStatus !== "PAID" &&
    order.paymentStatus !== "COD" &&
    order.paymentStatus !== "PROCESSING"
  ) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <Clock className="h-12 w-12 text-mute" />
        <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-mute">
          Order received — payment pending
        </p>
        <h1 className="mt-2 font-display text-4xl leading-[0.95]">Hang tight.</h1>
        <p className="mt-4 text-mute">
          We've recorded your order and are waiting for the payment gateway to confirm. This usually
          takes a few seconds — please don't refresh or try to pay again.
        </p>
        <p className="mt-6 font-mono text-[12px] text-ink">
          Order reference: #{orderId.slice(0, 8).toUpperCase()}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 flex items-center justify-center gap-2 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh status
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-ink text-paper"
      >
        <Check className="h-8 w-8" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-[11px] uppercase tracking-[0.28em] text-mute"
      >
        Order {orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : "confirmed"}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-3 font-display text-6xl leading-[0.95]"
      >
        Thank you.
        <br />
        <span className="italic text-mute">It's on its way.</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 max-w-md text-mute"
      >
        We'll email you a tracking link the moment it ships. Most orders move within 24 hours.
      </motion.p>

      {cod && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 border border-ink/20 bg-ink/5 px-6 py-4 text-[13px] text-ink"
        >
          <p className="font-semibold uppercase tracking-widest text-[11px] mb-1">
            Cash on Delivery
          </p>
          <p>Please have exact cash ready at delivery.</p>
        </motion.div>
      )}

      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-6 border border-line p-6"
        >
          <p className="font-medium">Create an account to easily track this order.</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-3 text-[12px] uppercase tracking-[0.22em] text-ink hover:underline underline-offset-4"
          >
            Sign up now →
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-10 flex gap-3"
      >
        <Link
          to="/"
          className="bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          Continue shopping
        </Link>
        <Link
          to="/account"
          className="border border-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em]"
        >
          Track order
        </Link>
      </motion.div>
    </div>
  );
}
