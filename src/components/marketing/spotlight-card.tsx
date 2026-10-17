"use client";

import type { PointerEvent, ReactNode } from "react";

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  function follow(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    card.style.setProperty("--mouse-x", `${Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))}%`);
    card.style.setProperty("--mouse-y", `${Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))}%`);
    card.dataset.spotlightActive = "true";
  }
  function leave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.dataset.spotlightActive = "false";
  }
  return <div className={`cta-spotlight-card ${className ?? ""}`} onPointerEnter={follow} onPointerMove={follow} onPointerLeave={leave} onPointerCancel={leave}>
    <div className="cta-spotlight" aria-hidden="true" />
    <div className="relative z-10">{children}</div>
  </div>;
}
