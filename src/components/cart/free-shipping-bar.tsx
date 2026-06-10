import { motion } from "framer-motion";
import { Truck } from "lucide-react";
import { inr } from "@/lib/format";

const THRESHOLD = 999;

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const remaining = Math.max(0, THRESHOLD - subtotal);
  const pct = Math.min(100, (subtotal / THRESHOLD) * 100);
  const qualified = remaining === 0 && subtotal > 0;

  return (
    <div className="border-b border-line bg-fog/60 px-6 py-4">
      <div className="flex items-center gap-2 text-[12px]">
        <Truck className="h-3.5 w-3.5" />
        {qualified ? (
          <p>
            You unlocked <span className="font-medium">free shipping (India Only)</span> ✓
          </p>
        ) : (
          <p>
            Add <span className="font-medium tabular-nums">{inr(remaining)}</span> more for{" "}
            <span className="font-medium">free shipping (India Only)</span>
          </p>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden bg-line">
        <motion.div
          className="h-full bg-ink"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
