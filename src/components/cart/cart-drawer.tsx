import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { useCart, itemKey } from "@/lib/store/cart";
import { inr } from "@/lib/format";
import { products } from "@/lib/data/products";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";

export function CartDrawer() {
  const { open, setOpen, items, setQty, remove, subtotal, savings } = useCart();
  const recommended = products.slice(0, 4);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const total = subtotal();
  const saved = savings();
  const shipping = total > 999 || total === 0 ? 0 : 79;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-full max-w-md flex-col bg-paper shadow-ink"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Your bag</p>
                <p className="font-display text-2xl">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close bag" className="icon-btn">
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length > 0 && <FreeShippingBar subtotal={total} />}

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <ShoppingBag className="mb-4 h-10 w-10 text-mute" />
                  <p className="font-display text-3xl">Your bag is empty</p>
                  <p className="mt-2 text-sm text-mute">
                    Start with the new drop or build a custom piece in the studio.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Link
                      to="/shop"
                      onClick={() => setOpen(false)}
                      className="bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.18em] text-paper"
                    >
                      Shop
                    </Link>
                    <Link
                      to="/studio"
                      onClick={() => setOpen(false)}
                      className="border border-ink px-5 py-3 text-[12px] uppercase tracking-[0.18em]"
                    >
                      Studio
                    </Link>
                  </div>
                </div>
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {items.map((it) => {
                      const k = itemKey(it);
                      return (
                        <motion.li
                          key={k}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-b border-line"
                        >
                          <div className="flex gap-4 px-6 py-5">
                            <img
                              src={it.image}
                              alt={it.name}
                              className="h-28 w-24 shrink-0 object-cover"
                            />
                            <div className="flex flex-1 flex-col">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[14px] font-medium leading-tight">{it.name}</p>
                                  <p className="mt-1 text-[12px] text-mute">
                                    {it.color} · {it.size}
                                    {it.custom ? " · Custom" : ""}
                                  </p>
                                </div>
                                <button
                                  onClick={() => remove(k)}
                                  className="text-[11px] uppercase tracking-[0.18em] text-mute hover:text-ink"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="mt-auto flex items-center justify-between">
                                <div className="flex items-center border border-line">
                                  <button
                                    onClick={() => setQty(k, it.qty - 1)}
                                    aria-label={`Decrease quantity of ${it.name}`}
                                    className="flex h-8 w-8 items-center justify-center transition hover:bg-fog focus-ink-inset"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className="w-8 text-center text-sm tabular-nums"
                                    aria-live="polite"
                                  >
                                    {it.qty}
                                  </span>
                                  <button
                                    onClick={() => setQty(k, it.qty + 1)}
                                    aria-label={`Increase quantity of ${it.name}`}
                                    className="flex h-8 w-8 items-center justify-center transition hover:bg-fog focus-ink-inset"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="text-right">
                                  <p className="text-[14px] tabular-nums">
                                    {inr(it.price * it.qty)}
                                  </p>
                                  {it.mrp > it.price && (
                                    <p className="text-[11px] text-mute line-through">
                                      {inr(it.mrp * it.qty)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}

              {items.length > 0 && (
                <div className="border-b border-line px-6 py-6">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">
                    You may also like
                  </p>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar">
                    {recommended.map((p) => (
                      <Link
                        key={p.id}
                        to="/p/$slug"
                        params={{ slug: p.slug }}
                        onClick={() => setOpen(false)}
                        className="w-32 shrink-0"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-fog">
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="h-full w-full object-cover transition duration-700 hover:scale-105"
                          />
                        </div>
                        <p className="mt-2 truncate text-[12px]">{p.name}</p>
                        <p className="text-[12px] tabular-nums text-mute">{inr(p.price)}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-line bg-paper px-6 py-5">
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Coupon code"
                    className="flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <button className="border border-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em]">
                    Apply
                  </button>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-mute">Subtotal</dt>
                    <dd className="tabular-nums">{inr(total)}</dd>
                  </div>
                  {saved > 0 && (
                    <div className="flex justify-between text-accent">
                      <dt>You saved</dt>
                      <dd className="tabular-nums">−{inr(saved)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-mute">Shipping</dt>
                    <dd className="tabular-nums">{shipping === 0 ? "Free" : inr(shipping)}</dd>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-2xl">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{inr(total + shipping)}</dd>
                  </div>
                </dl>
                <Link
                  to="/checkout"
                  onClick={() => setOpen(false)}
                  className="mt-5 block bg-ink py-4 text-center text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite"
                >
                  Checkout →
                </Link>
                <p className="mt-2 text-center text-[11px] text-mute">
                  Free shipping over ₹999 · 15-day returns
                </p>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
