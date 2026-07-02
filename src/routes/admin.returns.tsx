import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { returnsApi, type ReturnRequestDto, type ReturnStatus } from "@/lib/api/returns";
import { inr } from "@/lib/format";

// TanStack Router uses file-based routing; the `/admin/returns` route
// is not in `routeTree.gen.ts` until you run `npm run dev` (or the
// route generator). We cast the path so this file compiles standalone;
// it will pick up the real registered path on first dev/build.
export const Route = createFileRoute("/admin/returns" as never)({
  head: () => ({
    meta: [
      { title: "Returns — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminReturnsPage,
});

const STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RECEIVED: "Received",
  REFUND_INITIATED: "Refund initiated",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<ReturnStatus, string> = {
  REQUESTED: "bg-ink/10 text-ink",
  APPROVED: "bg-blue-100 text-blue-900",
  REJECTED: "bg-red-100 text-red-900",
  RECEIVED: "bg-purple-100 text-purple-900",
  REFUND_INITIATED: "bg-yellow-100 text-yellow-900",
  REFUNDED: "bg-green-100 text-green-900",
  CANCELLED: "bg-fog text-mute",
};

function AdminReturnsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: () => returnsApi.adminList(),
  });
  const [filter, setFilter] = useState<ReturnStatus | "ALL">("ALL");

  const list = (data ?? []).filter((r) => filter === "ALL" || r.status === filter);

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      returnsApi.adminReview(id, { decision }),
    onSuccess: () => {
      toast.success("Return updated");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const received = useMutation({
    mutationFn: (id: string) => returnsApi.adminReceived(id),
    onSuccess: () => {
      toast.success("Marked received");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const refund = useMutation({
    mutationFn: ({ id, amountInPaise }: { id: string; amountInPaise: number }) =>
      returnsApi.adminRefund(id, { amountInPaise }),
    onSuccess: () => {
      toast.success("Refund initiated via Razorpay");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const markRefunded = useMutation({
    mutationFn: (id: string) => returnsApi.adminMarkRefunded(id),
    onSuccess: () => {
      toast.success("Closed as refunded");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const handleRefund = (r: ReturnRequestDto) => {
    const input = window.prompt(
      `Refund amount in paise (₹1 = 100). Order total drives the default:`,
      "0",
    );
    if (!input) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive integer");
      return;
    }
    refund.mutate({ id: r.id, amountInPaise: n });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Admin · RMA</p>
          <h1 className="mt-1 font-display text-4xl">Returns</h1>
          <p className="mt-1 text-[12px] text-mute">
            Approve, mark received, refund, and close out customer returns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "REQUESTED", "APPROVED", "RECEIVED", "REFUND_INITIATED", "REFUNDED"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
                  filter === f ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ),
          )}
        </div>
      </header>

      {isLoading && <p className="text-mute">Loading returns…</p>}
      {error && (
        <p className="text-sm text-accent">
          Failed to load returns. Are you logged in as ADMIN?
        </p>
      )}

      {list.length === 0 && !isLoading && (
        <div className="border border-line p-8 text-center text-mute">
          No returns in this filter.
        </div>
      )}

      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="border border-line bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to="/admin/orders"
                  className="font-mono text-[13px] text-ink underline-offset-4 hover:underline"
                >
                  INK-{r.orderId.substring(0, 8).toUpperCase()}
                </Link>
                <p className="mt-1 text-[12px] text-mute">
                  Item {r.orderItemId.substring(0, 8)} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">{r.reason}</span>
                  {r.description && (
                    <span className="text-mute"> — {r.description}</span>
                  )}
                </p>
                {r.refund && (
                  <p className="mt-1 text-[11px] text-mute">
                    Refund {r.refund.status} · {inr(r.refund.amountInPaise / 100)}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                  STATUS_COLORS[r.status]
                }`}
              >
                {STATUS_LABELS[r.status]}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {r.status === "REQUESTED" && (
                <>
                  <button
                    onClick={() => review.mutate({ id: r.id, decision: "APPROVED" })}
                    disabled={review.isPending}
                    className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review.mutate({ id: r.id, decision: "REJECTED" })}
                    disabled={review.isPending}
                    className="border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-ink hover:border-ink disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {r.status === "APPROVED" && (
                <button
                  onClick={() => received.mutate(r.id)}
                  disabled={received.isPending}
                  className="border border-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  Mark received
                </button>
              )}
              {r.status === "RECEIVED" && (
                <button
                  onClick={() => handleRefund(r)}
                  disabled={refund.isPending}
                  className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
                >
                  Initiate refund
                </button>
              )}
              {r.status === "REFUND_INITIATED" && (
                <button
                  onClick={() => markRefunded.mutate(r.id)}
                  disabled={markRefunded.isPending}
                  className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
                >
                  Mark refunded
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
