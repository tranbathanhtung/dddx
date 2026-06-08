import z from "zod";
import { router, procedure } from "@/trpc";
import { studioCapsForRegistryAgent } from "@/agents/caps";
import { DEFAULT_AGENT_ID, getRegistry } from "@/agents";
import { err } from "./errors";

export const agent = router({
  registry: procedure.query(async () => {
    try {
      return getRegistry();
    } catch (error) {
      throw err.internal(error);
    }
  }),
  get: procedure
    .input(z.object({ id: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        const allAgents = await getRegistry(true);
        const agent = allAgents.agents.find((agent) => agent.id === input.id);
        if (!agent) {
          throw err.notFound(`Unknown agent "${input.id}"`);
        }
        return agent;
      } catch (error) {
        throw err.internal(error);
      }
    }),
  caps: procedure
    .input(
      z.object({
        agent: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const agentId = input.agent ?? DEFAULT_AGENT_ID;
        const allAgents = await getRegistry(true);
        const agent = allAgents.agents.find((a) => a.id === agentId);
        if (!agent) {
          throw err.notFound(`Unknown agent "${agentId}"`);
        }

        return {
          agent,
          caps: studioCapsForRegistryAgent(agent),
        };
      } catch (error) {
        throw err.internal(error);
      }
    }),
  /**
   * ACP `session/list` — connect-only; does not create a conversation session.
   *
   * @see https://agentclientprotocol.com/protocol/session-list
   */
  sessions: procedure
    .input(
      z.object({
        agent: z.string().optional(),
        cursor: z.string().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const cwd = ctx.dir;
        const runtime = await ctx.agentManager.acquire({
          id: input.agent ?? DEFAULT_AGENT_ID,
          cwd,
        });
        const result = await runtime.agent.listSessions({
          cwd,
          cursor: input.cursor as string | undefined,
        });

        const agentId = input.agent ?? DEFAULT_AGENT_ID;
        const registryAgent = (await getRegistry(true)).agents.find(
          (a) => a.id === agentId,
        );
        const studioCaps = registryAgent
          ? studioCapsForRegistryAgent(registryAgent)
          : undefined;

        return {
          ...result,
          agentCapabilities: studioCaps?.agentCapabilities,
          capabilityNotice: studioCaps?.capabilityNotice,
        };
      } catch (error) {
        throw err.internal(error);
      }
    }),
});
