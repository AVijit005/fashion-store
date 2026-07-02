import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";
import { toast } from "sonner";

/**
 * Verified-buyer review form. The backend enforces that the user owns a
 * DELIVERED order containing this product; if not, the API returns 403
 * and we show the error inline.
 */
export function ReviewForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => reviewsApi.create(slug, { rating, comment }),
    onSuccess: () => {
      toast.success("Review submitted");
      qc.invalidateQueries({ queryKey: ["reviews", slug] });
      setOpen(false);
      setComment("");
      setRating(5);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit review"),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 w-full border border-ink py-3 text-[12px] uppercase tracking-[0.22em] hover:bg-ink hover:text-paper"
      >
        Write a review
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (comment.trim().length < 10) {
          toast.error("Please write at least 10 characters");
          return;
        }
        submit.mutate();
      }}
      className="mt-6 space-y-3 border border-line p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
        Your rating
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
            className="press p-1"
          >
            <Star
              className={`h-5 w-5 ${
                i <= rating ? "fill-ink text-ink" : "text-line"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell others what you think…"
        className="w-full border border-line bg-transparent p-3 text-sm"
        rows={3}
        required
        minLength={10}
        maxLength={2000}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submit.isPending}
          className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-paper disabled:opacity-50"
        >
          {submit.isPending ? "…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setComment("");
            setRating(5);
          }}
          className="px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-mute hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-mute">
        Only verified buyers who have received their order can review this product.
      </p>
    </form>
  );
}
