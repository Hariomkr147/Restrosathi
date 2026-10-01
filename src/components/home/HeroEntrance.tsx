"use client";

import { useEffect, type ReactNode } from "react";
import { useAnimate } from "motion/react-mini";

export function HeroEntrance({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tokens = getComputedStyle(document.documentElement);
    const duration = parseFloat(tokens.getPropertyValue("--duration-base")) / 1000;
    const offset = tokens.getPropertyValue("--spacing").trim();
    const animation = animate(scope.current, { opacity: [0.9, 1], transform: [`translateY(${offset})`, "translateY(0px)"] }, { duration, ease: "easeOut" });
    return () => animation.stop();
  }, [animate, scope]);
  return <div ref={scope}>{children}</div>;
}
