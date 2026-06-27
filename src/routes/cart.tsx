import { createFileRoute, Link } from "@tanstack/react-router";
import { useCart, itemKey } from "@/lib/store/cart";
import { inr } from "@/lib/format";
import { Minus, Plus, X } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Bag — Ink Studio" }] }),
  component: CartPage,
});

function CartPage() {
  const hydrated = useHydrated();
  const { items: _items, setQty, remove, subtotal, savings, couponDiscount: _couponDiscount } = useCart();
  const items = hydrated ? _items : [];
  const sub = hydrated ? subtotal() : 0;
  const couponDiscount = hydrated ? _couponDiscount : 0;
  const grandTotal = Math.max(sub - couponDiscount, 0);
  const ship = grandTotal > 999 || grandTotal === 0 ? 0 : 79;
  const savingsAmt = hydrated ? savings() : 0;

  return (
    <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Your bag</p>
      <h1 className="mt-2 font-display text-5xl lg:text-6xl">Bag.</h1>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-3xl">Nothing here yet.</p>
          <Link
            to="/shop"
            className="mt-6 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
          <ul className="divide-y divide-line border-y border-line">
            {items.map((it) => {
              const k = itemKey(it);
              return (
                <li key={k} className="flex gap-4 py-6 md:gap-6">
                  <img
                    src={it.image}
                    alt={it.name}
                    className="h-32 w-28 shrink-0 object-cover md:h-40 md:w-32"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          to="/p/$slug"
                          params={{ slug: it.slug }}
                          className="text-[15px] hover:underline"
                        >
                          {it.name}
                        </Link>
                        <p className="mt-1 text-[12px] text-mute">
                          {it.color} · {it.size}
                          {it.custom ? " · Custom" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(k)}
                        aria-label={`Remove ${it.name} from bag`}
                        className="icon-btn h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-line">
                        <button
                          onClick={() => setQty(k, it.qty - 1)}
                          aria-label={`Decrease quantity of ${it.name}`}
                          className="flex h-9 w-9 items-center justify-center transition hover:bg-fog focus-ink-inset"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center tabular-nums" aria-live="polite">
                          {it.qty}
                        </span>
                        <button
                          onClick={() => setQty(k, it.qty + 1)}
                          disabled={it.maxQty !== undefined && it.qty >= it.maxQty}
                          aria-label={`Increase quantity of ${it.name}`}
                          className="flex h-9 w-9 items-center justify-center transition hover:bg-fog focus-ink-inset disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="tabular-nums">{inr(it.price * it.qty)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-line p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Summary</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-mute">Subtotal</dt>
                  <dd className="tabular-nums">{inr(sub)}</dd>
                </div>
                {savingsAmt > 0 && (
                  <div className="flex justify-between text-accent">
                    <dt>You saved</dt>
                    <dd className="tabular-nums">−{inr(savingsAmt)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-mute">Shipping</dt>
                  <dd className="tabular-nums">{ship === 0 ? "Free" : inr(ship)}</dd>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-[11px] uppercase tracking-[0.22em] text-mute">Total</dt>
                  <dd className="font-display text-3xl tabular-nums">{inr(grandTotal + ship)}</dd>
                </div>
              </dl>
              <Link
                to="/checkout"
                className="mt-6 block bg-ink py-4 text-center text-[12px] uppercase tracking-[0.22em] text-paper"
              >
                Checkout →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
