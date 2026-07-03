import { useState } from "react";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";
import { useAuthStore } from "@/lib/store/auth";
import { ReviewForm } from "./review-form";

/**
 * Phase 1 (audit item 1.1) — replaces the previously hardcoded REVIEWS
 * array. Now fetches real verified-buyer reviews from `/products/:slug/reviews`.
 *
 * Filters (all / with photos / 5★ / 4★) are computed client-side from the
 * fetched list; the histogram is derived from real ratings, not the
 * previously-fake `[72, 18, 6, 2, 2]` constants.
 */
export function ReviewsBlock({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<"all" | "photos" | "5" | "4">("all");
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => reviewsApi.list(slug),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-[1480px] px-5 py-20 text-mute lg:px-10">Loading reviews…</div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-[1480px] px-5 py-20 text-mute lg:px-10">
          Unable to load reviews.
        </div>
      </section>
    );
  }

  const { items, average, count } = data;

  const visible = items.filter((r) => {
    if (filter === "photos") return r.mediaUrls.length > 0;
    if (filter === "5") return r.rating === 5;
    if (filter === "4") return r.rating === 4;
    return true;
  });

  // Histogram from real ratings
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const total = items.filter((r) => r.rating === star).length;
    return count > 0 ? Math.round((total / count) * 100) : 0;
  });

  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[320px_1fr] lg:px-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Reviews</p>
          <p className="mt-2 font-display text-6xl tabular-nums">{average.toFixed(1)}</p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < Math.round(average) ? "fill-ink text-ink" : "text-line"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-mute">
            Based on {count} verified {count === 1 ? "review" : "reviews"}
          </p>
          <div className="mt-6 space-y-2">
            {[5, 4, 3, 2, 1].map((r, i) => (
              <div key={r} className="flex items-center gap-3 text-[12px]">
                <span className="w-3 tabular-nums">{r}</span>
                <div className="h-1.5 flex-1 bg-fog">
                  <div className="h-full bg-ink" style={{ width: `${dist[i]}%` }} />
                </div>
                <span className="w-8 tabular-nums text-mute">{dist[i]}%</span>
              </div>
            ))}
          </div>
          {isAuthed && count > 0 && <ReviewForm slug={slug} />}
          {isAuthed && count === 0 && (
            <div className="mt-6 rounded border border-line p-3 text-[12px] text-mute">
              No reviews yet. Be the first to share your experience after your order is delivered.
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "all", l: "All" },
              { k: "photos", l: "With photos" },
              { k: "5", l: "5 stars" },
              { k: "4", l: "4 stars" },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k as typeof filter)}
                className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
                  filter === f.k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <ul className="mt-6 space-y-6">
            {visible.length === 0 ? (
              <li className="text-sm text-mute">No reviews match this filter.</li>
            ) : (
              visible.map((r) => (
                <li key={r.id} className="border-b border-line pb-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < r.rating ? "fill-ink text-ink" : "text-line"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[12px] uppercase tracking-[0.18em] text-mute">
                        {r.userName}
                      </p>
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-graphite">{r.comment}</p>
                  {r.mediaUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {r.mediaUrls.map((u, i) => (
                        <img
                          key={i}
                          src={u}
                          alt=""
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
