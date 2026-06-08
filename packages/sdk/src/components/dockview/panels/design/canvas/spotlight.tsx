import { memo, type CSSProperties, useEffect, useRef } from "react";
import { useStoreApi } from "@xyflow/react";

type DotProps = { radius: number; fill?: string };

function Dot({ radius, fill }: DotProps) {
  return <circle cx={radius} cy={radius} r={radius} fill={fill} />;
}

export const Spotlight = memo(function Spotlight({
  id,
  gap = 16,
  size = 2,
  offset = 0,
  baseColor = "var(--canvas-spotlight-base)",
  highlightColor = "var(--canvas-spotlight-highlight)",
  style,
  className,
}: {
  id?: string;
  gap?: number | [number, number];
  size?: number;
  offset?: number | [number, number];
  baseColor?: string;
  highlightColor?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const store = useStoreApi();
  const rootRef = useRef<HTMLDivElement>(null);
  const basePatternRef = useRef<SVGPatternElement>(null);
  const highlightPatternRef = useRef<SVGPatternElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const lerped = useRef({ x: -1000, y: -1000 });

  const gapXY: [number, number] = Array.isArray(gap) ? gap : [gap, gap];
  const offsetXY: [number, number] = Array.isArray(offset)
    ? offset
    : [offset, offset];

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      lerped.current.x += (mouse.current.x - lerped.current.x) * 0.1;
      lerped.current.y += (mouse.current.y - lerped.current.y) * 0.1;
      rootRef.current?.style.setProperty("--mouse-x", `${lerped.current.x}px`);
      rootRef.current?.style.setProperty("--mouse-y", `${lerped.current.y}px`);

      const transform = store.getState().transform;
      const zoom = transform[2] ?? 1;
      const gx = gapXY[0] * zoom || 1;
      const gy = gapXY[1] * zoom || 1;
      const scaledSize = size * zoom;
      const scaledOffset: [number, number] = [
        (offsetXY[0] * zoom || 1) + gx / 2,
        (offsetXY[1] * zoom || 1) + gy / 2,
      ];
      const tx = transform[0] ?? 0;
      const ty = transform[1] ?? 0;

      for (const pattern of [basePatternRef.current, highlightPatternRef.current]) {
        if (!pattern) continue;
        pattern.setAttribute("x", String(tx % gx));
        pattern.setAttribute("y", String(ty % gy));
        pattern.setAttribute("width", String(gx));
        pattern.setAttribute("height", String(gy));
        pattern.setAttribute(
          "patternTransform",
          `translate(-${scaledOffset[0]},-${scaledOffset[1]})`,
        );
        const dot = pattern.firstElementChild;
        if (dot instanceof SVGCircleElement) {
          dot.setAttribute("r", String(scaledSize / 2));
        }
      }

      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [store, gapXY, offsetXY, size]);

  const patternId = `pattern-${store.getState().rfId}${id ?? ""}`;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 pointer-events-none ${className ?? ""}`}
      style={{ zIndex: 0, ...style }}
    >
      <svg className="absolute inset-0 w-full h-full">
        <pattern
          ref={basePatternRef}
          id={patternId}
          x={0}
          y={0}
          width={gapXY[0]}
          height={gapXY[1]}
          patternUnits="userSpaceOnUse"
        >
          <Dot radius={size / 2} fill={baseColor} />
        </pattern>
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <svg
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage:
            "radial-gradient(250px circle at var(--mouse-x) var(--mouse-y), black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(250px circle at var(--mouse-x) var(--mouse-y), black 0%, transparent 100%)",
        }}
      >
        <pattern
          ref={highlightPatternRef}
          id={`${patternId}-highlight`}
          x={0}
          y={0}
          width={gapXY[0]}
          height={gapXY[1]}
          patternUnits="userSpaceOnUse"
        >
          <Dot radius={size / 2} fill={highlightColor} />
        </pattern>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${patternId}-highlight)`}
        />
      </svg>
    </div>
  );
});
