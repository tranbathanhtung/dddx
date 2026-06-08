import { useEffect, useLayoutEffect, useRef, useState } from "react";

const CONFIG = {
  easing: 0.12,
  autoSpeed: 1,
  interactionRadius: 72,
  dotScale: 1.2,
  maxParticles: 2200,
  minSpacing: 14,
  maxSpacing: 28,
} as const;

const THEME_COLORS = [
  { hex: "#3b82f6", rgb: "59, 130, 246" },
  { hex: "#f43f5e", rgb: "244, 63, 94" },
  { hex: "#84cc16", rgb: "132, 204, 22" },
  { hex: "#d946ef", rgb: "217, 70, 239" },
  { hex: "#e11d48", rgb: "225, 29, 72" },
  { hex: "#06b6d4", rgb: "6, 182, 212" },
  { hex: "#f59e0b", rgb: "245, 158, 11" },
] as const;

type ThemeColor = (typeof THEME_COLORS)[number];

function pickThemeColor() {
  return THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)]!;
}

interface Particle {
  originX: number;
  originY: number;
  currX: number;
  currY: number;
}

function measureContainer(el: HTMLElement | null) {
  if (!el) return null;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

function spacingForSize(w: number, h: number) {
  const margin = 12;
  const innerW = Math.max(0, w - margin * 2);
  const innerH = Math.max(0, h - margin * 2);
  const area = innerW * innerH;
  const target = Math.sqrt(area / CONFIG.maxParticles);
  return Math.min(
    CONFIG.maxSpacing,
    Math.max(CONFIG.minSpacing, target),
  );
}

/** Cached arrow path (24×24 viewBox). */
const CURSOR_PATH = new Path2D(
  "M4 2 L20 13.5 L13.5 15 L18 22.5 L15 24.5 L10.5 17 L4 21 V2 Z",
);

function drawCursorBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  theme: ThemeColor,
  time: number,
  labelWidth: number,
  badgeBg: string,
  badgeFg: string,
) {
  const ax = x - 4;
  const ay = y - 2;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.fillStyle = theme.hex;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fill(CURSOR_PATH);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const badgeX = 22;
  const badgeY = 2;
  const padX = 10;
  const padY = 6;
  const dotSize = 6;
  const gap = 6;
  const textW = labelWidth;
  const badgeW = padX + dotSize + gap + textW + padX;
  const badgeH = 20;
  const r = 4;

  ctx.fillStyle = badgeBg;
  ctx.strokeStyle = theme.hex;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, r);
  ctx.fill();
  ctx.stroke();

  const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 5));
  const dotCx = badgeX + padX + dotSize / 2;
  const dotCy = badgeY + badgeH / 2;
  ctx.beginPath();
  ctx.arc(dotCx, dotCy, dotSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${theme.rgb}, ${0.35 + pulse * 0.5})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotCx, dotCy, dotSize / 4, 0, Math.PI * 2);
  ctx.fillStyle = theme.hex;
  ctx.fill();

  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = badgeFg;
  ctx.textBaseline = "middle";
  ctx.fillText(
    label,
    badgeX + padX + dotSize + gap,
    badgeY + badgeH / 2,
  );

  ctx.restore();
}

export function NodeLoadingOverlay({ label }: { label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef(label);
  labelRef.current = label;

  const [themeColor] = useState(pickThemeColor);

  const stateRef = useRef({
    cursorX: 0,
    cursorY: 0,
    targetX: 0,
    targetY: 0,
    centerX: 0,
    centerY: 0,
    timeOffset: Math.random() * 5000,
  });

  const particlesRef = useRef<Particle[]>([]);
  const labelWidthRef = useRef(48);
  const visibleRef = useRef(true);
  const dprRef = useRef(1);
  const badgeColorsRef = useRef({ bg: "#ffffff", fg: "#0a0a0a" });

  const scaleCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return false;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return false;

    const size = measureContainer(container);
    if (!size) return false;

    const { w: computedW, h: computedH } = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;

    canvas.width = Math.round(computedW * dpr);
    canvas.height = Math.round(computedH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cs = getComputedStyle(container);
    badgeColorsRef.current = {
      bg: cs.backgroundColor,
      fg: cs.color,
    };

    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    labelWidthRef.current = ctx.measureText(labelRef.current).width;

    const spacing = spacingForSize(computedW, computedH);
    const margin = 12;
    const particles: Particle[] = [];

    stateRef.current.centerX = computedW / 2;
    stateRef.current.centerY = computedH / 2;

    for (let x = margin; x < computedW - margin; x += spacing) {
      for (let y = margin; y < computedH - margin; y += spacing) {
        particles.push({
          originX: x,
          originY: y,
          currX: x,
          currY: y,
        });
      }
    }

    particlesRef.current = particles;
    return true;
  };

  useLayoutEffect(() => {
    scaleCanvas();
    const id = requestAnimationFrame(scaleCanvas);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | undefined;
    let intersectionObserver: IntersectionObserver | undefined;

    resizeObserver = new ResizeObserver(() => scaleCanvas());
    resizeObserver.observe(container);

    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
      },
      { root: null, threshold: 0 },
    );
    intersectionObserver.observe(container);

    scaleCanvas();

    const grayStyle = "rgba(120, 120, 120, 0.15)";
    const theme = themeColor;
    const rgb = theme.rgb;

    let time = stateRef.current.timeOffset;

    const tick = () => {
      animationFrameId = requestAnimationFrame(tick);

      if (!visibleRef.current) return;

      time += 0.008 * CONFIG.autoSpeed;

      const dpr = dprRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      if (w <= 0 || h <= 0) return;

      const state = stateRef.current;
      const ampX = w * 0.35;
      const ampY = h * 0.4;

      state.targetX =
        state.centerX +
        Math.sin(time * 0.7) * Math.cos(time * 0.43) * ampX;
      state.targetY =
        state.centerY +
        Math.cos(time * 0.61) * Math.sin(time * 0.28) * ampY;

      const easedX = state.cursorX + (state.targetX - state.cursorX) * CONFIG.easing;
      const easedY = state.cursorY + (state.targetY - state.cursorY) * CONFIG.easing;
      state.cursorX = easedX;
      state.cursorY = easedY;

      ctx.clearRect(0, 0, w, h);

      const mouseR = CONFIG.interactionRadius;
      const mouseR2 = mouseR * mouseR;
      const particles = particlesRef.current;
      const baseR = CONFIG.dotScale;

      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const dx = p.originX - easedX;
        const dy = p.originY - easedY;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < mouseR2) continue;

        p.currX += (p.originX - p.currX) * 0.18;
        p.currY += (p.originY - p.currY) * 0.18;

        ctx.moveTo(p.currX + baseR, p.currY);
        ctx.arc(p.currX, p.currY, baseR, 0, Math.PI * 2);
      }
      ctx.fillStyle = grayStyle;
      ctx.fill();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const dx = p.originX - easedX;
        const dy = p.originY - easedY;
        const dist2 = dx * dx + dy * dy;

        if (dist2 >= mouseR2) continue;

        const dist = Math.sqrt(dist2);
        const factor = 1 - dist / mouseR;
        const radius = baseR + Math.pow(factor, 2.5) * 4.2;

        p.currX += (p.originX - p.currX) * 0.18;
        p.currY += (p.originY - p.currY) * 0.18;

        ctx.beginPath();
        ctx.arc(p.currX, p.currY, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${0.15 + factor * 0.85})`;
        ctx.fill();
      }

      const { bg, fg } = badgeColorsRef.current;
      drawCursorBadge(
        ctx,
        easedX,
        easedY,
        labelRef.current,
        theme,
        time,
        labelWidthRef.current,
        bg,
        fg,
      );
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [themeColor]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 overflow-hidden bg-background/90 select-none"
      style={{
        boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${themeColor.hex}cc`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
}
