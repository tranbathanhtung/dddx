import { IconLoader2, IconLoader } from "@tabler/icons-react";

import { cn } from "../../lib/utils";

function Spinner({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"svg"> & { variant?: "default" | "2" }) {
  if (variant === "2") {
    return (
      <IconLoader2
        role="status"
        aria-label="Loading"
        className={cn("size-4 animate-spin", className)}
        {...props}
      />
    );
  }
  return (
    <IconLoader
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
