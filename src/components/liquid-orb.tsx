"use client";

import { motion, useReducedMotion } from "motion/react";
import { BrainCircuit, Sparkles } from "lucide-react";

export function LiquidOrb() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="liquid-orb" aria-label="Learning Twin de LUMA visualizado como una esfera viva">
      <motion.div
        className="liquid-orb__halo liquid-orb__halo--one"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="liquid-orb__halo liquid-orb__halo--two"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="liquid-orb__core"
        animate={reduceMotion ? undefined : { y: [0, -10, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="liquid-orb__shine" />
        <BrainCircuit size={72} strokeWidth={1.25} aria-hidden="true" />
        <div className="liquid-orb__metric liquid-orb__metric--top glass-subtle">
          <Sparkles size={14} aria-hidden="true" />
          <span>Tu mejor siguiente paso</span>
        </div>
        <div className="liquid-orb__metric liquid-orb__metric--bottom glass-subtle">
          <strong>+18%</strong>
          <span>progreso verificado</span>
        </div>
      </motion.div>
      <div className="liquid-orb__floor" />
    </div>
  );
}
