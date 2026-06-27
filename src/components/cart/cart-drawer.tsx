import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart, itemKey } from "@/lib/store/cart";
import { inr } from "@/lib/format";
import { catalogApi, type Product } from "@/lib/api/catalog";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function CartDrawer() {
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal);
  const savings = useCart((s) => s.savings);
  const couponCode = useCart((s) => s.couponCode);
  const couponDiscount = useCart((s) => s.couponDiscount);
  const applyCoupon = useCart((s) => s.applyCoupon);
  const removeCoupon = useCart((s) => s.removeCoupon);
  const [localCoupon, setLocalCoupon] = useState("");
  const [applying, setApplying] = useState(false);
  const { data: recommended = [] } = useQuery({
    queryKey: ["cart-recommended"],
    queryFn: async () => {
      const res = await catalogApi.getProducts({ limit: 4 });
      return res.products || [];
    },
  });

  const total = subtotal();
  const saved = savings() + couponDiscount;
  const grandTotal = Math.max(total - couponDiscount, 0);
  const shipping = grandTotal > 999 || grandTotal === 0 ? 0 : 79;

  const handleApply = async () => {
    if (!localCoupon.trim()) return;
    setApplying(true);
    try {
      await applyCoupon(localCoupon.trim());
      setLocalCoupon("");
    } catch (err) {
      console.error("Failed to apply coupon:", err);
      toast.error("Failed to apply coupon");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full max-w-md flex-col p-0 border-none bg-paper shadow-ink sm:max-w-md [&>button]:top-6 [&>button]:right-6 [&>button]:opacity-100">
        <SheetHeader className="border-b border-line px-6 py-5 text-left">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute mb-1">Your bag</p>
          <SheetTitle className="font-display text-2xl font-normal">
            {items.length} item{items.length === 1 ? "" : "s"}
          </SheetTitle>
        </SheetHeader>

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
                                disabled={it.qty <= 1}
                                aria-label={`Decrease quantity of ${it.name}`}
                                className="flex h-8 w-8 items-center justify-center transition hover:bg-fog focus-ink-inset disabled:opacity-50 disabled:cursor-not-allowed"
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
                                disabled={it.maxQty !== undefined && it.qty >= it.maxQty}
                                aria-label={`Increase quantity of ${it.name}`}
                                className="flex h-8 w-8 items-center justify-center transition hover:bg-fog focus-ink-inset disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-[14px] tabular-nums">{inr(it.price * it.qty)}</p>
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
                {recommended.map((p: Product) => (
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
            {couponCode ? (
              <div className="flex items-center justify-between border border-ink bg-fog px-4 py-3">
                <div>
                  <p className="text-[12px] font-medium">Coupon applied: {couponCode}</p>
                  <p className="text-[11px] text-accent">−{inr(couponDiscount)}</p>
                </div>
                <button onClick={removeCoupon} className="press p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  placeholder="Coupon code"
                  value={localCoupon}
                  onChange={(e) => setLocalCoupon(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApply()}
                  disabled={applying}
                  className="flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-ink disabled:opacity-50"
                />
                <button
                  onClick={handleApply}
                  disabled={applying || !localCoupon.trim()}
                  className="border border-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
                >
                  {applying ? "..." : "Apply"}
                </button>
              </div>
            )}
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
                <dd className="tabular-nums">{inr(grandTotal + shipping)}</dd>
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
              Free shipping over ₹999 (India Only) · 15-day returns
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
