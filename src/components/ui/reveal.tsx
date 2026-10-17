"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [16, 0], opacity: [0.65, 1] }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.5 }}>{children}</motion.div>;
}
