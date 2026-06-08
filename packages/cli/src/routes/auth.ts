import z from "zod";

import { router, procedure } from "@/trpc";
import {
  getAuthKey,
  maskAuthKey,
  readAuthFile,
  removeAuthKey,
  setAuthKey,
  type AuthProviderId,
} from "@/util/auth-store";
import { err } from "./errors";

const providerSchema = z.enum(["gateway", "openrouter"]);

export const auth = router({
  status: procedure.query(async () => {
    try {
      const file = await readAuthFile();
      const providers: Record<
        AuthProviderId,
        { configured: boolean; maskedKey?: string }
      > = {
        gateway: { configured: false },
        openrouter: { configured: false },
      };
      for (const id of providerSchema.options) {
        const key = file[id]?.key?.trim();
        if (key) {
          providers[id] = { configured: true, maskedKey: maskAuthKey(key) };
        }
      }
      return { providers };
    } catch (error) {
      throw err.internal(error);
    }
  }),

  setKey: procedure
    .input(
      z.object({
        provider: providerSchema,
        key: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await setAuthKey(input.provider, input.key);
        const key = await getAuthKey(input.provider);
        return {
          provider: input.provider,
          maskedKey: key ? maskAuthKey(key) : undefined,
        };
      } catch (error) {
        throw err.internal(error);
      }
    }),

  removeKey: procedure
    .input(z.object({ provider: providerSchema }))
    .mutation(async ({ input }) => {
      try {
        await removeAuthKey(input.provider);
        return { provider: input.provider };
      } catch (error) {
        throw err.internal(error);
      }
    }),
});
