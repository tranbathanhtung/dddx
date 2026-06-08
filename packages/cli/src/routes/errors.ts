import { TRPCError } from "@trpc/server";

export const err = {
  notFound: (msg = "Not found") =>
    new TRPCError({ code: "NOT_FOUND", message: msg }),

  unauthorized: () =>
    new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" }),

  forbidden: () => new TRPCError({ code: "FORBIDDEN", message: "Not allowed" }),

  badRequest: (msg: string) =>
    new TRPCError({ code: "BAD_REQUEST", message: msg }),

  internal: (cause?: unknown) =>
    new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: (cause as Error)?.message || "Something went wrong",
      cause,
    }),
};
