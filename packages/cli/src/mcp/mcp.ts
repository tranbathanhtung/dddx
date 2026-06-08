import type { Hono } from "hono";
import type { McpServer } from "@agentclientprotocol/sdk";
import { McpServer as McpSdkServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";
import { resolveStudioPort } from "@/studio/registry";
import { connectUrl } from "@/util/service-endpoints";
import { Questions } from "./questions";

const questionOptionSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    label: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
]);

const questionItemSchema = z.object({
  id: z.string().optional(),
  kind: z
    .enum([
      "text-options",
      "svg-options",
      "slider",
      "file",
      "freeform",
      "text",
      "single",
      "multi",
    ])
    .optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  multi: z.boolean().optional(),
  options: z.array(questionOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  default: z.number().optional(),
  placeholder: z.string().optional(),
  allowCustom: z.boolean().optional(),
});

const inputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Overall form title shown above the questions"),
  questions: z
    .array(questionItemSchema)
    .min(1)
    .describe("Ordered list of questions to present in the studio UI"),
});

let transport: StreamableHTTPTransport | undefined;
let ready: Promise<void> | undefined;

function createServer(): McpSdkServer {
  const server = new McpSdkServer({
    name: "dddx",
    version: "0.1.0",
  });

  server.registerTool(
    "questions_v2",
    {
      description:
        "Present a structured question form in the studio UI. Does not return user answers immediately — end your turn after calling so the user can respond in the question bar.",
      inputSchema: inputSchema.shape,
    },
    async (input) => {
      const { title, questions } = Questions.form(input);
      if (questions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "No valid questions in input",
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              pending: true,
              status: "awaiting_user",
              title,
              questionCount: questions.length,
              message:
                "Questions are shown in the studio UI. End your turn and wait for the user's answers on the next message.",
            }),
          },
        ],
      };
    },
  );

  return server;
}

async function ensureTransport(): Promise<StreamableHTTPTransport> {
  if (transport) return transport;

  ready ??= (async () => {
    const next = new StreamableHTTPTransport();
    await createServer().connect(next);
    transport = next;
  })();

  await ready;
  return transport!;
}

/** Studio `questions_v2` MCP over HTTP (same process as the studio worker). */
export namespace Mcp {
  export const name = "dddx";
  export const path = "/mcp/dddx";

  export function url(port = resolveStudioPort()): string {
    return connectUrl(port, path);
  }

  /** ACP `createSession` / `resumeSession` MCP server list. */
  export function servers(port = resolveStudioPort()): McpServer[] {
    return [
      {
        name,
        type: "http",
        url: url(port),
        headers: [],
      },
    ];
  }

  /** Mount streamable HTTP MCP on the studio Hono app. */
  export function mount(app: Hono): void {
    app.all(path, async (c) => {
      const active = await ensureTransport();
      return active.handleRequest(c);
    });
  }
}
