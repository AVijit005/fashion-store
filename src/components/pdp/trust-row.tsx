import { Truck, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

async function fetchEtaFor(pincode: string) {
  // TODO: Replace with real logistics API call to backend (e.g., Shiprocket)
  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("Invalid pincode");
  }
  
  await new Promise((r) => setTimeout(r, 600));

  if (pincode.startsWith("00")) {
    throw new Error("Unserviceable area");
  }

  // Fallback static ETA since API is not implemented
  return { start: 3, end: 5, cod: true };
}

export function PdpTrustRow() {
  const [pin, setPin] = useState("");
  const [activePin, setActivePin] = useState("");

  const {
    data: eta,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["eta", activePin],
    queryFn: () => fetchEtaFor(activePin),
    enabled: activePin.length === 6,
    retry: 1,
  });

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return;
    setActivePin(pin);
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
          <button
            disabled={isFetching || pin.length !== 6}
            className="border border-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
          >
            {isFetching ? "..." : "Check"}
          </button>
        </div>
        {eta && !error && (
          <p className="mt-3 text-sm">
            Delivered in{" "}
            <span className="font-medium">
              {eta.start}–{eta.end} days
            </span>{" "}
            · {eta.cod ? "COD available" : "Prepaid only"}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-accent">
            {(error as Error).message || "Enter a valid 6-digit pincode"}
          </p>
        )}
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
