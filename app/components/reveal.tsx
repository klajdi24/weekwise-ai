"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}

/** Soft staggered entrance for page sections. Respects prefers-reduced-motion via GSAP matchMedia. */
export default function Reveal({ children, className = "", stagger = 0.08, y = 18 }: RevealProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          motionOk: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion: boolean };
          const items = root.current?.querySelectorAll(".reveal-item");
          if (!items?.length) return;

          if (reduceMotion) {
            gsap.set(items, { opacity: 1, y: 0 });
            return;
          }

          gsap.fromTo(
            items,
            { opacity: 0, y },
            {
              opacity: 1,
              y: 0,
              duration: 0.55,
              stagger,
              ease: "power3.out",
              clearProps: "transform",
            }
          );
        }
      );
    },
    { scope: root }
  );

  return (
    <div ref={root} className={`reveal-ready ${className}`}>
      {children}
    </div>
  );
}
