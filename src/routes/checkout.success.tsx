import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : "",
  }),
  head: () => ({
    meta: [{ title: "Order placed — Ink Studio" }],
  }),
  component: Success,
});

function Success() {
  const { orderId } = Route.useSearch();

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
