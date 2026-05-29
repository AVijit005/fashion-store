import { Truck, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";

function etaFor(pincode: string) {
  // deterministic mock — 2-6 day window based on pincode hash
  const n = pincode.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const start = 2 + (n % 3);
  const end = start + 2;
  return { start, end };
}

export function PdpTrustRow() {
  const [pin, setPin] = useState("");
  const [eta, setEta] = useState<{ start: number; end: number } | null>(null);
  const [error, setError] = useState(false);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError(true);
      setEta(null);
      return;
    }
    setError(false);
    setEta(etaFor(pin));
  };

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={check} className="border border-line p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-mute">
          <Truck className="h-3.5 w-3.5" /> Delivery
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter pincode"
            inputMode="numeric"
            className="flex-1 border-b border-line bg-transparent py-2 text-sm outline-none focus:border-ink"
          />
          <button className="border border-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em]">
            Check
          </button>
        </div>
        {eta && (
          <p className="mt-3 text-sm">
            Delivered in{" "}
            <span className="font-medium">
              {eta.start}–{eta.end} days
            </span>{" "}
            · COD available
          </p>
        )}
        {error && <p className="mt-3 text-sm text-accent">Enter a valid 6-digit pincode</p>}
      </form>

      <ul className="grid grid-cols-2 gap-3 border-y border-line py-5 text-center sm:grid-cols-4">
        <Trust icon={<Truck className="h-4 w-4" />} label="Free over ₹999" />
        <Trust icon={<RotateCcw className="h-4 w-4" />} label="7-day returns" />
        <Trust icon={<ShieldCheck className="h-4 w-4" />} label="Secure pay" />
        <Trust icon={<Wallet className="h-4 w-4" />} label="COD available" />
      </ul>
    </div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="space-y-1">
      <div className="mx-auto flex justify-center">{icon}</div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
    </li>
  );
}
