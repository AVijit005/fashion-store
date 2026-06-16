import { useState } from "react";
import { useAddAddress } from "@/lib/api/users";

export function AddressForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  const [isDefault, setIsDefault] = useState(false);

  const addAddress = useAddAddress();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!street || !city || !state || !postalCode || !country) return;

    addAddress.mutate(
      { street, city, state, postalCode, country, isDefault },
      { onSuccess: () => onSuccess() },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-mute mb-1">
          Street Address
        </label>
        <input
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute mb-1">
            City
          </label>
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border border-line bg-transparent px-4 py-2 text-sm outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute mb-1">
            State
          </label>
          <input
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full border border-line bg-transparent px-4 py-2 text-sm outline-none focus:border-ink"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute mb-1">
            Postal Code
          </label>
          <input
            required
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full border border-line bg-transparent px-4 py-2 text-sm outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-mute mb-1">
            Country
          </label>
          <input
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled
            className="w-full border border-line bg-fog/30 px-4 py-2 text-sm outline-none cursor-not-allowed"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="default-address"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        <label htmlFor="default-address" className="text-sm">
          Set as default shipping address
        </label>
      </div>
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={addAddress.isPending}
          className="flex-1 bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-paper hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {addAddress.isPending ? "Saving..." : "Save Address"}
        </button>
      </div>
    </form>
  );
}
