import { SidebarTrigger } from "@/components/ui/sidebar";
import { memo } from "react";
import { type IDockviewHeaderActionsProps } from "dockview-react";

export const PrefixHeaderActionsComponent = memo(
  (_props: IDockviewHeaderActionsProps) => {
    return (
      <div className="flex h-full items-center px-2 pr-2">
        <SidebarTrigger variant="ghost" className="rounded-md" />
      </div>
    );
  },
);
