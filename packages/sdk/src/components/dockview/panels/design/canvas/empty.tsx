import { IconFolderPlus, IconPalette } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function CanvasEmpty({
  onCreate,
  pending,
}: {
  onCreate: (name?: string | null) => void;
  pending: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <Empty className="border-0 bg-transparent shadow-none">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-white shadow-button">
            <IconPalette />
          </EmptyMedia>
          <EmptyTitle>No design workspace yet</EmptyTitle>
          <EmptyDescription>
            Create a design workspace to start prototyping HTML pages on the
            canvas. Each workspace lives under{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              .dddx/designs
            </code>
            .
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="default"
            onClick={() => {
              const name = window.prompt("Design name");
              onCreate(name);
            }}
            disabled={pending}
          >
            <IconFolderPlus className="size-4" />
            {pending ? "Creating…" : "Create design"}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
