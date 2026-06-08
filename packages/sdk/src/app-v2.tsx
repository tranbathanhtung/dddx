import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ThemeConfigProvider } from "./components/agent-elements/theme-config";
import { DockviewProvider } from "./components/dockview/provider";
import {
  useApplyStudioTheme,
  useReplayExtensionsOnHydrate,
  useStudioStore,
} from "@/store";

export default function App() {
  useApplyStudioTheme();
  useReplayExtensionsOnHydrate();
  const theme = useStudioStore((s) => s.ui.theme);
  const maximized = useStudioStore((s) => s.ui.maximized);

  return (
    <ThemeConfigProvider colorMode={theme}>
      <SidebarProvider open={maximized ? false : undefined}>
        <AppSidebar />
        <SidebarInset
          className={cn(
            "z-20 min-h-svh",
            maximized
              ? "shadow-none"
              : "shadow-[-8px_0_24px_-16px_rgba(0,0,0,0.15)]",
          )}
        >
          <DockviewProvider />
        </SidebarInset>
      </SidebarProvider>
    </ThemeConfigProvider>
  );
}
