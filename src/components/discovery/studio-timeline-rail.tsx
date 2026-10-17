"use client";

import { motion, useReducedMotion } from "motion/react";

export function StudioTimelineRail() {
  const reduced = useReducedMotion();
  return <motion.span aria-hidden="true" className="studio-timeline-rail" initial={false} whileInView={reduced ? undefined : { scaleY: [0.1, 1] }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />;
}
