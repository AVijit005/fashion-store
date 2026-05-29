import { type ReactNode } from "react";

export function Marquee({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  return (
    <div className="flex overflow-hidden">
      <div
        className="flex shrink-0 animate-marquee gap-12 whitespace-nowrap pr-12"
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
