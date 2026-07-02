import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { returnsApi } from "@/lib/api/returns";
import { toast } from "sonner";
import { X } from "lucide-react";

const REASONS = [
  "Wrong size",
  "Wrong color",
  "Damaged in transit",
  "Quality issue",
  "Item not as described",
  "Changed my mind",
];

/**
 * Phase 1 (audit item 1.5) — user-facing return request modal.
 *
 * The backend enforces:
 *   - Order must be DELIVERED.
 *   - User must own the order (403 otherwise).
 *   - Within autoApproveWindowDays (default 15, configurable).
 *   - One non-cancelled return per order item.
 */
export function ReturnRequestModal({
  orderItemId,
  productTitle,
  onClose,
}: {
  orderItemId: string;
  productTitle: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => returnsApi.create({ orderItemId, reason, description: description || undefined }),
    onSuccess: () => {
      toast.success("Return request submitted — we'll review within 24h");
      qc.invalidateQueries({ queryKey: ["my-returns"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit return"),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason) {
            toast.error("Pick a reason");
            return;
          }
          submit.mutate();
        }}
        className="w-full max-w-md space-y-4 bg-paper p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Return request</p>
            <h2 id="return-modal-title" className="mt-1 font-display text-2xl">
              {productTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close return modal"
            className="press p-1 text-mute hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute">
            Reason
          </label>
          <select
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full border border-line bg-paper p-2 text-sm"
          >
            <option value="">Select a reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute">
            Details (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything else we should know?"
            rows={3}
            maxLength={2000}
            className="mt-1 w-full border border-line bg-paper p-2 text-sm"
          />
        </div>

        <p className="text-[11px] text-mute">
          We accept returns within {`15`} days of delivery. Custom studio pieces are
          non-returnable unless defective.
        </p>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submit.isPending || !reason}
            className="flex-1 bg-ink py-3 text-[12px] uppercase tracking-[0.22em] text-paper disabled:opacity-50"
          >
            {submit.isPending ? "Submitting…" : "Submit return"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-mute hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
