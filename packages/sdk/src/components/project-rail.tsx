import {
  IconArrowsMinimize,
  IconCommand,
  IconGhost2,
  IconHelp,
  IconMoon,
  IconPlus,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";

import { useNavigate } from "react-router-dom";

import {
  DOCK_PANELS,
  type DockPanelId,
} from "@/components/dockview/panel-registry";
import { useActiveProjects } from "@/hooks/use-active-projects";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { studioProjectPath } from "@/lib/project-path";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const PROJECT_COLORS = [
  {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-300",
  },
  {
    bg: "bg-pink-100",
    text: "text-pink-700",
    ring: "ring-pink-300",
  },
  {
    bg: "bg-sky-100",
    text: "text-sky-700",
    ring: "ring-sky-300",
  },
  {
    bg: "bg-amber-100",
    text: "text-amber-700",
    ring: "ring-amber-300",
  },
  {
    bg: "bg-violet-100",
    text: "text-violet-700",
    ring: "ring-violet-300",
  },
] as const;

function projectColor(directory: string) {
  let hash = 0;
  for (let i = 0; i < directory.length; i += 1) {
    hash = (hash + directory.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length]!;
}

function ProjectAvatar({
  initial,
  directory,
  active,
}: {
  initial: string;
  directory: string;
  active?: boolean;
}) {
  const colors = projectColor(directory);

  return (
    <div
      className={cn(
        "flex items-center justify-center size-full text-sm font-semibold",
        colors.bg,
        colors.text,
        // active && `ring-2 ${colors.ring}`,
      )}
    >
      {initial}
    </div>
  );
}

export function ProjectRail() {
  const navigate = useNavigate();
  const { projects, isLoading } = useActiveProjects();
  const theme = useStudioStore((s) => s.ui.theme);
  const toggleTheme = useStudioStore((s) => s.ui.toggleTheme);
  const maximized = useStudioStore((s) => s.ui.maximized);
  const toggleMaximized = useStudioStore((s) => s.ui.toggleMaximized);
  const panel = useStudioStore((s) => s.ui.panel);
  const isDark = theme === "dark";

  const openDockPanel = (panelId: DockPanelId) => {
    dispatch(CustomEventEnum.OpenDockPanel, { detail: { panelId } });
  };

  return (
    <Sidebar
      collapsible="none"
      className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded bg-linear-to-b from-yellow-300 to-orange-500 text-white shadow-lg shadow-black/20 ring-1 ring-black/10">
                  <IconGhost2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">DDD</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              {maximized
                ? DOCK_PANELS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        tooltip={{
                          children: item.title,
                          hidden: false,
                        }}
                        isActive={panel === item.id}
                        className="px-2.5 md:px-2 text-muted-foreground"
                        onClick={() => openDockPanel(item.id)}
                      >
                        <item.icon className="size-4" />
                        <span className="sr-only">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : isLoading
                  ? Array.from({ length: 1 }).map((_, index) => (
                      <SidebarMenuItem key={index}>
                        <Skeleton className="mx-auto size-8 rounded-md" />
                      </SidebarMenuItem>
                    ))
                  : projects.map((project) => {
                      const colors = projectColor(project.directory);
                      return (
                        <SidebarMenuItem key={project.directory}>
                          <SidebarMenuButton
                            tooltip={{
                              children: project.name,
                              hidden: false,
                            }}
                            isActive={project.isCurrent}
                            className={cn(
                              "p-0 size-8 justify-center rounded-md",
                              // colors.bg,
                              // colors.text,
                            )}
                            onClick={() => {
                              if (project.isCurrent) return;
                              navigate(studioProjectPath(project.slug));
                            }}
                          >
                            <span>{project.initial}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-1.5 pb-3">
        <SidebarMenu>
          {maximized ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Exit maximize layout"
                className="px-2.5 md:px-2 text-muted-foreground"
                onClick={toggleMaximized}
              >
                <IconArrowsMinimize className="size-4" />
                <span className="sr-only">Exit maximize layout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isDark ? "Light mode" : "Dark mode"}
              className="px-2.5 md:px-2 text-muted-foreground"
              onClick={toggleTheme}
            >
              {isDark ? (
                <IconSun className="size-4" />
              ) : (
                <IconMoon className="size-4" />
              )}
              <span className="sr-only">
                {isDark ? "Light mode" : "Dark mode"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help"
              className="px-2.5 md:px-2 text-muted-foreground"
            >
              <IconHelp className="size-4" />
              <span className="sr-only">Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
