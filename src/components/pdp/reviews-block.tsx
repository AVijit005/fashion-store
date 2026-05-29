import { useState } from "react";
import { Star } from "lucide-react";

type Review = {
  n: string;
  size: string;
  fit: string;
  t: string;
  b: string;
  rating: number;
  image?: string;
};

const REVIEWS: Review[] = [
  {
    n: "Arjun K.",
    size: "L",
    fit: "True to size",
    t: "Heaviest tee I own",
    b: "Exactly what the listing promised. Drop shoulder sits perfectly, fabric has real weight to it.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&q=80&auto=format&fit=crop",
  },
  {
    n: "Mira S.",
    size: "M",
    fit: "Runs a bit large",
    t: "Drape is incredible",
    b: "Boxy in the best way. The bone colorway photographs beautifully.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80&auto=format&fit=crop",
  },
  {
    n: "Ravi T.",
    size: "M",
    fit: "True to size",
    t: "Worth every rupee",
    b: "Premium feel, packaging was beautiful too. Will order again.",
    rating: 5,
  },
  {
    n: "Ishan P.",
    size: "XL",
    fit: "True to size",
    t: "Solid heavyweight",
    b: "Holds shape after multiple washes. Stitching is clean.",
    rating: 4,
  },
];

export function ReviewsBlock({ rating, count }: { rating: number; count: number }) {
  const [filter, setFilter] = useState<"all" | "photos" | "5" | "4">("all");
  const dist = [72, 18, 6, 2, 2];

  const visible = REVIEWS.filter((r) => {
    if (filter === "photos") return !!r.image;
    if (filter === "5") return r.rating === 5;
    if (filter === "4") return r.rating === 4;
    return true;
  });

  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[320px_1fr] lg:px-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Reviews</p>
          <p className="mt-2 font-display text-6xl tabular-nums">{rating.toFixed(1)}</p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < Math.round(rating) ? "fill-ink text-ink" : "text-line"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-mute">Based on {count} verified reviews</p>
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
          <button className="mt-6 w-full border border-ink py-3 text-[12px] uppercase tracking-[0.22em] hover:bg-ink hover:text-paper">
            Write a review
          </button>
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
            {visible.map((r) => (
              <li key={r.n} className="border-b border-line pb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < r.rating ? "fill-ink text-ink" : "text-line"}`}
                        />
                      ))}
                    </div>
                    <p className="text-[12px] uppercase tracking-[0.18em] text-mute">{r.n}</p>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
                    Size {r.size} · {r.fit}
                  </p>
                </div>
                <p className="mt-2 font-medium">{r.t}</p>
                <p className="mt-1 text-sm text-graphite">{r.b}</p>
                {r.image && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <img src={r.image} alt="" className="aspect-square w-full object-cover" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
