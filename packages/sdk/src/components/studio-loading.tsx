import { unmountLoading } from "@/loading";

export type StudioLoadingStatus = "loading" | "error";

export interface StudioLoadingProps {
  status: StudioLoadingStatus;
  error: string | null;
}

function statusLabel(
  status: StudioLoadingStatus,
  error: string | null,
): string {
  if (error) return error;
  switch (status) {
    case "loading":
      return "Resolving project…";
    case "error":
      return "Connection error";
  }
}

/**
 * Full-screen loading state rendered while the tRPC project query is in
 * flight or has failed. Unmounts as soon as the project identity resolves.
 */
export function StudioLoading({ status, error }: StudioLoadingProps) {
  const isFatal = status === "error";
  unmountLoading();
  return (
    <div className="w-full h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        {!isFatal && (
          <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-60" />
        )}
        <div
          className={
            isFatal ? "text-sm text-destructive" : "text-sm opacity-70"
          }
        >
          {statusLabel(status, error)}
        </div>
        {isFatal && (
          <div className="text-xs opacity-50 max-w-xs text-center">
            Make sure <code>dddx</code> is running in your project.
          </div>
        )}
      </div>
    </div>
  );
}
