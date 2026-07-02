export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Compute discount percent. Accepts a nullable MRP — when MRP is not set
 * (admin hasn't filled it in) the function returns 0 so callers can use
 * the value directly without null guards. Phase 1 (audit item 1.2):
 * never fabricate an MRP — null means "no MRP known, don't show a
 * strikethrough or a discount badge."
 */
export const pct = (price: number, mrp: number | null | undefined): number => {
  if (mrp == null || mrp <= 0 || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};
