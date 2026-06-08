"use client";

import { useEffect, useRef, useState } from "react";
import { IconLayoutGrid } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { cn } from "@/lib/utils";

export type ChatEmptyMode = "agent" | "design";

const CHAT_EMPTY_SUBTITLES: Record<ChatEmptyMode, string> = {
  agent:
    "Edit the real codebase inside your running app. Describe a change and the agent will ship it.",
  design:
    "Explore ideas, prototype on the canvas, then apply to your app when ready.",
};

interface GhostIconProps {
  className?: string;
  size?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  direction?: "up" | "down" | "left" | "right" | "idle";
  frightened?: boolean;
}

/** Logo ghost (icon-tabler-ghost-2). */
export function LogoGhostIcon({
  size = 24,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 2,
  direction = "idle",
  frightened = false,
}: GhostIconProps) {
  const eyeDx = direction === "left" ? -1.5 : direction === "right" ? 1.5 : 0;
  const eyeDy = direction === "up" ? -1.5 : direction === "down" ? 1.5 : 0;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-200"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      {frightened ? (
        <>
          <path
            d={`M${10 + eyeDx} ${10 + eyeDy}h.01`}
            stroke="#ffffff"
            strokeWidth={2.5}
          />
          <path
            d={`M${14 + eyeDx} ${10 + eyeDy}h.01`}
            stroke="#ffffff"
            strokeWidth={2.5}
          />
        </>
      ) : (
        <>
          <path d={`M${10 + eyeDx} ${9 + eyeDy}h.01`} strokeWidth={3} />
          <path d={`M${14 + eyeDx} ${9 + eyeDy}h.01`} strokeWidth={3} />
        </>
      )}
      <path
        d="M12 3a7 7 0 0 1 7 7v1l1 0a2 2 0 1 1 0 4l-1 0v3l2 3h-10a6 6 0 0 1 -6 -5.775l0 -.226l-1 0a2 2 0 0 1 0 -4l1 0v-1a7 7 0 0 1 7 -7l0 .001"
        fill={fill === "none" ? "rgba(255,255,255,0.05)" : fill}
      />
      {frightened ? (
        <path
          d="M10 14.5c1-1 3-1 4 0"
          stroke={stroke}
          strokeWidth={1.5}
          fill="none"
        />
      ) : (
        <path d="M11 14h2a1 1 0 0 0 -2 0" />
      )}
    </svg>
  );
}

/** Playful ghost (icon-tabler-ghost) with open mouth. */
export function PlayfulGhostIcon({
  size = 24,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 2,
  direction = "idle",
  frightened = false,
}: GhostIconProps) {
  const eyeDx = direction === "left" ? -1.5 : direction === "right" ? 1.5 : 0;
  const eyeDy = direction === "up" ? -1.5 : direction === "down" ? 1.5 : 0;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M5 11a7 7 0 0 1 14 0v7a1.78 1.78 0 0 1 -3.1 1.4a1.65 1.65 0 0 0 -2.6 0a1.65 1.65 0 0 1 -2.6 0a1.65 1.65 0 0 0 -2.6 0a1.78 1.78 0 0 1 -3.1 -1.4v-7"
        fill={fill === "none" ? "rgba(255,255,255,0.05)" : fill}
      />
      {frightened ? (
        <>
          <path
            d={`M${9.5 + eyeDx} ${10.5 + eyeDy}h.01`}
            stroke="#ffffff"
            strokeWidth={2.5}
          />
          <path
            d={`M${13.5 + eyeDx} ${10.5 + eyeDy}h.01`}
            stroke="#ffffff"
            strokeWidth={2.5}
          />
        </>
      ) : (
        <>
          <path d={`M${10 + eyeDx} ${10 + eyeDy}l.01 0`} strokeWidth={3} />
          <path d={`M${14 + eyeDx} ${10 + eyeDy}l.01 0`} strokeWidth={3} />
        </>
      )}
      {frightened ? (
        <path
          d="M10 15c1-1 3-1 4 0"
          stroke={stroke}
          strokeWidth={1.5}
          fill="none"
        />
      ) : (
        <path d="M10 14a3.5 3.5 0 0 0 4 0" />
      )}
    </svg>
  );
}

const GHOST_EYE_CYCLE: NonNullable<GhostIconProps["direction"]>[] = [
  "idle",
  "right",
  "right",
  "down",
  "left",
  "up",
  "idle",
];

type SidekickGhostConfig = {
  id: string;
  className: string;
  position: string;
  hidden: { x: number; y: number };
  direction: NonNullable<GhostIconProps["direction"]>;
  intriguedDirection: NonNullable<GhostIconProps["direction"]>;
  size: number;
  delay: number;
};

const SIDEKICK_GHOSTS: SidekickGhostConfig[] = [
  {
    id: "teal",
    className: "text-teal-500 dark:text-teal-400",
    position: "absolute -right-3 bottom-0",
    hidden: { x: 16, y: 2 },
    direction: "left",
    intriguedDirection: "down",
    size: 18,
    delay: 0,
  },
  {
    id: "amber",
    className: "text-amber-500 dark:text-amber-400",
    position: "absolute -left-3 top-1",
    hidden: { x: -14, y: -2 },
    direction: "right",
    intriguedDirection: "down",
    size: 16,
    delay: 0.06,
  },
  {
    id: "violet",
    className: "text-violet-500 dark:text-violet-400",
    position: "absolute right-0 -top-2",
    hidden: { x: 10, y: -12 },
    direction: "down",
    intriguedDirection: "down",
    size: 15,
    delay: 0.12,
  },
  {
    id: "rose",
    className: "text-rose-500 dark:text-rose-400",
    position: "absolute -left-2 bottom-1",
    hidden: { x: -12, y: 6 },
    direction: "right",
    intriguedDirection: "down",
    size: 17,
    delay: 0.04,
  },
];

const SPIRIT_ORBS = [
  {
    id: "primary",
    className: "absolute -left-3 top-3 size-2.5 rounded-full bg-primary/50",
    animate: {
      y: [0, -10, 0],
      opacity: [0.2, 0.55, 0.2],
      scale: [1, 1.2, 1],
    },
    duration: 2.6,
    delay: 0,
  },
  {
    id: "teal",
    className: "absolute right-0 top-0 size-2 rounded-full bg-teal-500/45",
    animate: { y: [0, -7, 0], opacity: [0.15, 0.4, 0.15] },
    duration: 3.1,
    delay: 0.7,
  },
  {
    id: "violet",
    className: "absolute bottom-1 left-0 size-2 rounded-full bg-violet-500/45",
    animate: { y: [0, -5, 0], opacity: [0.15, 0.35, 0.15] },
    duration: 2.2,
    delay: 1.2,
  },
  {
    id: "amber",
    className: "absolute -right-2 top-5 size-1.5 rounded-full bg-amber-500/45",
    animate: {
      y: [0, -8, 0],
      x: [0, 2, 0],
      opacity: [0.12, 0.38, 0.12],
    },
    duration: 2.8,
    delay: 0.35,
  },
  {
    id: "rose",
    className: "absolute bottom-2 right-1 size-2 rounded-full bg-rose-500/40",
    animate: {
      y: [0, -6, 0],
      opacity: [0.1, 0.32, 0.1],
      scale: [1, 1.15, 1],
    },
    duration: 3.4,
    delay: 1.6,
  },
];

function AnimatedGhostEmptyMedia({ intrigued }: { intrigued?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [direction, setDirection] =
    useState<NonNullable<GhostIconProps["direction"]>>("right");
  const [frightened, setFrightened] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const spookClearRef = useRef<number | undefined>(undefined);
  const peekClearRef = useRef<number | undefined>(undefined);
  const intriguedRef = useRef(intrigued);
  intriguedRef.current = intrigued;

  useEffect(() => {
    if (prefersReducedMotion) return;

    let eyeIndex = 0;
    const eyeTimer = window.setInterval(() => {
      if (intriguedRef.current) return;
      eyeIndex = (eyeIndex + 1) % GHOST_EYE_CYCLE.length;
      setDirection(GHOST_EYE_CYCLE[eyeIndex] ?? "idle");
    }, 2400);

    const spookTimer = window.setInterval(() => {
      if (intriguedRef.current) return;
      setFrightened(true);
      spookClearRef.current = window.setTimeout(
        () => setFrightened(false),
        520,
      );
    }, 7000);

    const peekTimer = window.setInterval(() => {
      if (intriguedRef.current) return;
      setPeeking(true);
      peekClearRef.current = window.setTimeout(() => setPeeking(false), 2200);
    }, 4800);

    return () => {
      window.clearInterval(eyeTimer);
      window.clearInterval(spookTimer);
      window.clearInterval(peekTimer);
      if (spookClearRef.current) window.clearTimeout(spookClearRef.current);
      if (peekClearRef.current) window.clearTimeout(peekClearRef.current);
    };
  }, [prefersReducedMotion]);

  const gaze = intrigued ? "down" : direction;
  const showSidekicks = peeking || intrigued;

  if (prefersReducedMotion) {
    return (
      <div className="relative flex size-24 items-center justify-center text-primary">
        <LogoGhostIcon size={40} direction={gaze} />
        {SIDEKICK_GHOSTS.map((sidekick) => (
          <div
            key={sidekick.id}
            aria-hidden
            className={cn(
              "pointer-events-none absolute opacity-60",
              sidekick.position,
              sidekick.className,
            )}
          >
            <PlayfulGhostIcon
              size={sidekick.size}
              direction={
                intrigued ? sidekick.intriguedDirection : sidekick.direction
              }
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex size-24 items-center justify-center">
      {SPIRIT_ORBS.map((orb) => (
        <motion.span
          key={orb.id}
          aria-hidden
          className={orb.className}
          animate={orb.animate}
          transition={{
            repeat: Infinity,
            duration: orb.duration,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      <motion.div
        className="relative z-10 text-primary"
        animate={
          frightened
            ? { x: [0, -3, 3, -2, 2, 0], scale: [1, 1.06, 1] }
            : intrigued
              ? { y: [0, -4, 0], rotate: [0, 4, -4, 0], scale: [1, 1.04, 1] }
              : { y: [0, -9, 0], rotate: [-4, 4, -4] }
        }
        transition={
          frightened
            ? { duration: 0.4, ease: "easeOut" }
            : intrigued
              ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
              : { repeat: Infinity, duration: 3.4, ease: "easeInOut" }
        }
      >
        <LogoGhostIcon
          size={44}
          direction={gaze}
          frightened={frightened}
          stroke="currentColor"
        />
      </motion.div>

      {SIDEKICK_GHOSTS.map((sidekick) => (
        <motion.div
          key={sidekick.id}
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-0",
            sidekick.position,
            sidekick.className,
            "text-foreground",
          )}
          initial={false}
          animate={{
            opacity: showSidekicks ? 0.95 : 0,
            x: showSidekicks ? 0 : sidekick.hidden.x,
            y: showSidekicks ? (intrigued ? [0, -2, 0] : 0) : sidekick.hidden.y,
            rotate: showSidekicks && intrigued ? [0, 6, -6, 0] : 0,
          }}
          transition={{
            opacity: { duration: 0.3, delay: sidekick.delay },
            x: {
              type: "spring",
              stiffness: 280,
              damping: 20,
              delay: sidekick.delay,
            },
            y: intrigued
              ? {
                  repeat: Infinity,
                  duration: 1.2 + sidekick.delay,
                  ease: "easeInOut",
                  delay: sidekick.delay,
                }
              : { duration: 0.25, delay: sidekick.delay },
            rotate: intrigued
              ? {
                  repeat: Infinity,
                  duration: 1.4,
                  ease: "easeInOut",
                  delay: sidekick.delay,
                }
              : { duration: 0.2 },
          }}
        >
          <PlayfulGhostIcon
            size={sidekick.size}
            direction={
              intrigued ? sidekick.intriguedDirection : sidekick.direction
            }
            stroke="currentColor"
          />
        </motion.div>
      ))}
    </div>
  );
}

export function ChatEmptyState({
  mode,
  disabled,
}: {
  mode: ChatEmptyMode;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [pluginsHovered, setPluginsHovered] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center">
      <Empty className="border-0 bg-transparent p-0 shadow-none">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="mb-3 size-auto rounded-none bg-transparent [&_svg]:size-auto"
          >
            <AnimatedGhostEmptyMedia intrigued={pluginsHovered} />
          </EmptyMedia>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.12 }}
          >
            <EmptyDescription>{CHAT_EMPTY_SUBTITLES[mode]}</EmptyDescription>
          </motion.div>
        </EmptyHeader>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.24 }}
        >
          <EmptyContent>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onMouseEnter={() => setPluginsHovered(true)}
              onMouseLeave={() => setPluginsHovered(false)}
              onFocus={() => setPluginsHovered(true)}
              onBlur={() => setPluginsHovered(false)}
              onClick={() =>
                dispatch(CustomEventEnum.OpenDockPanel, {
                  detail: { panelId: "plugins" },
                })
              }
            >
              <IconLayoutGrid className="size-4" />
              Explore plugins
            </Button>
          </EmptyContent>
        </motion.div>
      </Empty>
    </div>
  );
}
