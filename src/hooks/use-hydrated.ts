import { useEffect, useState } from "react";

/**
 * Returns true only after the component has mounted on the client.
 * Use to gate any value that differs between SSR and client (e.g. persisted
 * zustand stores reading from localStorage) and would cause hydration mismatches.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
