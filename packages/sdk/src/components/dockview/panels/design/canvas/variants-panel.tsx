import { useState } from "react";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { cn } from "@/lib/utils";

export type CreativeRange = "refine" | "explore" | "reimagine";

export type VariationAspect =
  | "layout"
  | "colorScheme"
  | "images"
  | "textFont"
  | "textContent";

const CREATIVE_RANGES: { id: CreativeRange; label: string }[] = [
  { id: "refine", label: "Refine" },
  { id: "explore", label: "Explore" },
  { id: "reimagine", label: "Reimagine" },
];

const ASPECTS: { id: VariationAspect; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "colorScheme", label: "Color scheme" },
  { id: "images", label: "Images" },
  { id: "textFont", label: "Text font" },
  { id: "textContent", label: "Text content" },
];

export type VariantsPanelTarget = {
  nodeId: string;
  label: string;
};

export function buildVariationsPrompt(
  label: string,
  count: number,
  range: CreativeRange,
  aspects: VariationAspect[],
  instructions: string,
): string {
  const aspectLabels = ASPECTS.filter((aspect) =>
    aspects.includes(aspect.id),
  ).map((aspect) => aspect.label.toLowerCase());

  const lines = [
    `Generate ${count} design variations of "${label}".`,
    `Creative range: ${range}.`,
  ];

  if (aspectLabels.length > 0) {
    lines.push(`Vary: ${aspectLabels.join(", ")}.`);
  }

  const trimmed = instructions.trim();
  if (trimmed) {
    lines.push(`Additional instructions: ${trimmed}`);
  }

  return lines.join("\n");
}

type VariantsPanelProps = {
  target: VariantsPanelTarget;
  onClose: () => void;
};

export function VariantsPanel({ target, onClose }: VariantsPanelProps) {
  const [count, setCount] = useState(3);
  const [range, setRange] = useState<CreativeRange>("explore");
  const [instructions, setInstructions] = useState("");
  const [aspects, setAspects] = useState<VariationAspect[]>([]);

  const toggleAspect = (aspect: VariationAspect) => {
    setAspects((prev) =>
      prev.includes(aspect)
        ? prev.filter((item) => item !== aspect)
        : [...prev, aspect],
    );
  };

  const onGenerate = () => {
    dispatch(CustomEventEnum.DesignCanvasRequestSend, {
      detail: {
        nodeId: target.nodeId,
        text: buildVariationsPrompt(
          target.label,
          count,
          range,
          aspects,
          instructions,
        ),
      },
    });
    onClose();
  };

  return (
    <div className="flex w-72 flex-col rounded-xl border bg-background/95 p-4 shadow-long backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight">
          Generate variations
        </h2>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <IconX className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Number of options</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setCount((value) => Math.max(1, value - 1))}
              disabled={count <= 1}
            >
              <IconMinus className="size-3.5" />
            </Button>
            <div className="flex h-8 min-w-10 flex-1 items-center justify-center rounded-lg border bg-muted/40 font-mono text-sm tabular-nums">
              {count}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setCount((value) => Math.min(8, value + 1))}
              disabled={count >= 8}
            >
              <IconPlus className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Creative range</Label>
          <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/30 p-1">
            {CREATIVE_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  range === option.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setRange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="variants-instructions">Custom instructions</Label>
          <Textarea
            id="variants-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Additional instructions..."
            className="min-h-20 resize-none text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Aspects to vary</Label>
          <div className="space-y-1">
            {ASPECTS.map((aspect) => {
              const checked = aspects.includes(aspect.id);
              return (
                <button
                  key={aspect.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                  onClick={() => toggleAspect(aspect.id)}
                >
                  <span>{aspect.label}</span>
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                  >
                    {checked ? (
                      <span className="size-1.5 rounded-full bg-current" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button type="button" className="mt-5 w-full" onClick={onGenerate}>
        Generate variations
      </Button>
    </div>
  );
}
