import type {
  LanguageModelV3FilePart,
  LanguageModelV3Prompt,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { ContentBlock } from "spawn-agent";

export interface PromptConversionOptions {
  readonly lastUserOnly?: boolean;
  readonly warnOnSystemMessage?: boolean;
}

export interface PromptConversionResult {
  readonly systemPrompt: string | undefined;
  readonly blocks: ContentBlock[];
  readonly warnings: SharedV3Warning[];
}

export const convertPromptToContentBlocks = (
  prompt: LanguageModelV3Prompt,
  options: PromptConversionOptions = {},
): PromptConversionResult => {
  const systemParts: string[] = [];
  const blocks: ContentBlock[] = [];
  const warnings: SharedV3Warning[] = [];

  const messages = options.lastUserOnly
    ? extractTrailingUserSlice(prompt)
    : prompt;
  if (options.lastUserOnly && messages.length === 0 && prompt.length > 0) {
    warnings.push({
      type: "unsupported",
      feature: "no-trailing-user-message",
      details:
        "Session-bound mode requires a trailing user message in the prompt; nothing was sent over session/prompt",
    });
  }
  if (options.lastUserOnly && messages.length < prompt.length) {
    const skipped = prompt.length - messages.length;
    warnings.push({
      type: "compatibility",
      feature: "session-history-replay",
      details: `Skipping ${skipped} message(s) of conversation history; the ACP session already holds them`,
    });
  }

  for (const message of messages) {
    switch (message.role) {
      case "system": {
        if (options.warnOnSystemMessage) {
          warnings.push({
            type: "unsupported",
            feature: "system-message-on-bound-session",
            details:
              "System messages can only be applied at session creation. Pass `systemPrompt` to `createSpawnAgentSession` instead",
          });
        } else {
          systemParts.push(message.content);
        }
        break;
      }
      case "user": {
        for (const part of message.content) {
          if (part.type === "text") {
            blocks.push({ type: "text", text: part.text });
          } else if (part.type === "file") {
            const fileBlock = mapFilePart(part);
            if (fileBlock) {
              blocks.push(fileBlock);
            } else {
              warnings.push({
                type: "unsupported",
                feature: "file-part",
                details: `Unsupported file mediaType "${part.mediaType}" for ACP`,
              });
            }
          }
        }
        break;
      }
      case "assistant": {
        const assistantText = message.content
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("");
        if (assistantText.length > 0) {
          blocks.push({ type: "text", text: `Assistant: ${assistantText}` });
        }
        const toolCallNames = message.content.flatMap((part) =>
          part.type === "tool-call" ? [part.toolName] : [],
        );
        if (toolCallNames.length > 0) {
          warnings.push({
            type: "unsupported",
            feature: "assistant-tool-call-replay",
            details: `Cannot replay prior assistant tool calls (${toolCallNames.join(", ")}) into an ACP session; use loadSession or resumeSession to continue an existing conversation`,
          });
        }
        break;
      }
      case "tool": {
        warnings.push({
          type: "unsupported",
          feature: "tool-result-message",
          details:
            "ACP runs tools internally via MCP servers; tool result messages cannot be replayed inline",
        });
        break;
      }
    }
  }

  return {
    systemPrompt: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    blocks,
    warnings,
  };
};

const mapFilePart = (
  part: LanguageModelV3FilePart,
): ContentBlock | undefined => {
  const { data, mediaType, filename } = part;
  if (mediaType.startsWith("image/")) {
    return {
      type: "image",
      data: dataAsBase64(data),
      mimeType: mediaType,
      ...(data instanceof URL ? { uri: data.toString() } : {}),
    };
  }
  if (mediaType.startsWith("audio/")) {
    return {
      type: "audio",
      data: dataAsBase64(data),
      mimeType: mediaType,
    };
  }
  if (data instanceof URL) {
    return {
      type: "resource_link",
      uri: data.toString(),
      mimeType: mediaType,
      name: filename ?? data.toString(),
    };
  }
  return undefined;
};

const dataAsBase64 = (data: LanguageModelV3FilePart["data"]): string => {
  if (typeof data === "string") return data;
  if (data instanceof URL) return data.toString();
  if (data instanceof Uint8Array) return Buffer.from(data).toString("base64");
  throw new Error("Unsupported file data format for ACP content block");
};

const extractTrailingUserSlice = (
  prompt: LanguageModelV3Prompt,
): LanguageModelV3Prompt => {
  let cut = prompt.length;
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index]!.role === "user" || prompt[index]!.role === "system") {
      cut = index;
    } else {
      break;
    }
  }
  return prompt.slice(cut);
};
