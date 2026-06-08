"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

const springTransition = {
  type: "spring" as const,
  bounce: 0.25,
  duration: 0.5,
};

const userEnter = {
  initial: {
    opacity: 0,
    y: 130,
    x: -120,
    scale: 0.3,
  },
  animate: { opacity: 1, y: 0, x: 0, scale: 1 },
  transition: springTransition,
};

const assistantEnter = {
  initial: {
    opacity: 0,
    y: 20,
    x: -20,
    scale: 0.9,
  },
  animate: { opacity: 1, y: 0, x: 0, scale: 1 },
  transition: springTransition,
};

type AnimatedEnterProps = {
  messageId: string;
  variant: "user" | "assistant";
  /** Message ids present when the list first mounted — those skip enter animation. */
  mountBaseline: ReadonlySet<string>;
  /** When true, skip layout animations so sibling messages are not re-measured on every stream chunk. */
  disableLayout?: boolean;
  className?: string;
  children: ReactNode;
};

export function AnimatedMessageEnter({
  messageId,
  variant,
  mountBaseline,
  disableLayout = false,
  className,
  children,
}: AnimatedEnterProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimateRef = useRef(!mountBaseline.has(messageId));
  const shouldAnimate =
    !prefersReducedMotion && shouldAnimateRef.current;
  const motionProps = variant === "user" ? userEnter : assistantEnter;
  const transformOrigin =
    variant === "user" ? "100% 100%" : "0% 100%";

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      layout={disableLayout ? false : "position"}
      className={className}
      style={{ transformOrigin }}
      initial={shouldAnimate ? motionProps.initial : false}
      animate={motionProps.animate}
      transition={motionProps.transition}
    >
      {children}
    </motion.div>
  );
}
