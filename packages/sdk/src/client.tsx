import { useMemo, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@dddx/cli";
import { studioApiHeaders } from "@/lib/project-path";

// ─── tRPC proxy ───────────────────────────────────────────────────────────────

/** Re-exported tRPC proxy. Convention: import as `api`. */
export const api = createTRPCReact<AppRouter>();

/** Vanilla, non-React tRPC client for imperative calls. */
export function createDddxClient() {
  return api.createClient({
    links: [
      splitLink({
        /**
         * Heavy session procedures must not share httpBatchLink with fast
         * queries or one slow call blocks the entire batch (207).
         */
        condition(op) {
          return (
            op.path === "agent.sessions" ||
            op.path === "chat.list" ||
            op.path === "agent.registry"
          );
        },
        true: httpLink({
          url: "/trpc",
          headers: () => studioApiHeaders(),
        }),
        false: httpBatchLink({
          url: "/trpc",
          headers: () => studioApiHeaders(),
        }),
      }),
    ],
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface DddxProviderProps extends PropsWithChildren {}

export function DddxProvider({ children }: DddxProviderProps) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {},
        },
      }),
    [],
  );
  const trpcClient = useMemo(() => createDddxClient(), []);

  return (
    <api.Provider client={trpcClient} queryClient={client}>
      <QueryClientProvider client={client}>
        {/* <ReactiveBridge /> */}
        {children}
      </QueryClientProvider>
    </api.Provider>
  );
}
