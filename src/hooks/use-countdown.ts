import { useEffect, useState } from "react";

export function useCountdown(targetMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Date.now() >= targetMs) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= targetMs) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const diff = Math.max(0, targetMs - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, done: diff === 0 };
}
