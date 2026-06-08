import { createGateway } from "@ai-sdk/gateway";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateImage, generateText, type GeneratedFile } from "ai";

import type { AuthProviderId } from "@/util/auth-store";

export type ImageProviderId = AuthProviderId;

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageSizeTier = "1K" | "2K";

export type ImageModelDef = {
  id: string;
  label: string;
  /** Multimodal LLMs return images via generateText; image-only via generateImage. */
  mode: "text" | "image";
};

export const IMAGE_MODELS: Record<ImageProviderId, ImageModelDef[]> = {
  gateway: [
    {
      id: "google/gemini-3.1-flash-image-preview",
      label: "Nano Banana 2",
      mode: "text",
    },
    {
      id: "google/gemini-2.5-flash-image",
      label: "Nano Banana",
      mode: "text",
    },
    {
      id: "google/gemini-3-pro-image",
      label: "Nano Banana Pro",
      mode: "text",
    },
    {
      id: "openai/gpt-image-2",
      label: "ChatGPT Images 2.0",
      mode: "image",
    },
  ],
  openrouter: [
    {
      id: "google/gemini-3.1-flash-image-preview",
      label: "Nano Banana 2",
      mode: "text",
    },
    {
      id: "google/gemini-2.5-flash-image",
      label: "Nano Banana",
      mode: "text",
    },
    {
      id: "google/gemini-3-pro-image-preview",
      label: "Nano Banana Pro",
      mode: "text",
    },
    {
      id: "openai/gpt-5.4-image-2",
      label: "ChatGPT Images 2.0",
      mode: "text",
    },
  ],
};

export function resolveImageModel(
  provider: ImageProviderId,
  modelId: string,
): ImageModelDef | undefined {
  return IMAGE_MODELS[provider]?.find((m) => m.id === modelId);
}

export type ImageGenerateConfig = {
  provider: ImageProviderId;
  modelId: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSizeTier;
  prompt: string;
};

export function getImageGenerationCatalog() {
  return {
    providers: [
      { id: "gateway" as const, label: "Vercel AI Gateway" },
      { id: "openrouter" as const, label: "OpenRouter" },
    ],
    models: IMAGE_MODELS,
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] as ImageAspectRatio[],
    sizes: ["1K", "2K"] as ImageSizeTier[],
  };
}

export type ImageGenerationCatalog = ReturnType<
  typeof getImageGenerationCatalog
>;

export function defaultModelForProvider(
  catalog: ImageGenerationCatalog,
  provider: ImageProviderId,
): string {
  return catalog.models[provider][0]?.id ?? "";
}

export function defaultImageGenerateConfig(
  catalog: ImageGenerationCatalog,
): ImageGenerateConfig {
  const provider = catalog.providers[0]!.id;
  return {
    provider,
    modelId: defaultModelForProvider(catalog, provider),
    aspectRatio: catalog.aspectRatios[0]!,
    size: catalog.sizes[0]!,
    prompt: "",
  };
}

function extensionForMediaType(mediaType: string): string {
  const sub = mediaType.split("/")[1]?.split(";")[0]?.trim();
  if (sub === "jpeg") return "jpg";
  if (sub === "svg+xml") return "svg";
  return sub || "png";
}

export function filenameBaseFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/, "");
  return slug || "image";
}

function fileToBuffer(file: GeneratedFile): Buffer {
  if (file.uint8Array) return Buffer.from(file.uint8Array);
  if (file.base64) return Buffer.from(file.base64, "base64");
  throw new Error("Generated image has no binary payload");
}

function pickImageFile(files: GeneratedFile[]): GeneratedFile {
  const image = files.find((f) => f.mediaType?.startsWith("image/"));
  if (!image) throw new Error("Model did not return an image");
  return image;
}

type CanvasImagePayload = {
  bytes: Buffer;
  mediaType: string;
  extension: string;
};

function payloadFromFile(file: GeneratedFile): CanvasImagePayload {
  const mediaType = file.mediaType ?? "image/png";
  return {
    bytes: fileToBuffer(file),
    mediaType,
    extension: extensionForMediaType(mediaType),
  };
}

function payloadFromBase64Image(image: GeneratedFile): CanvasImagePayload {
  const mediaType = image.mediaType ?? "image/png";
  return {
    bytes: Buffer.from(image.base64, "base64"),
    mediaType,
    extension: extensionForMediaType(mediaType),
  };
}

function captionFromModelText(text: string | undefined): string | undefined {
  const caption = text?.trim();
  return caption || undefined;
}

function googleProviderOptions(
  aspectRatio: ImageAspectRatio,
  size: ImageSizeTier,
) {
  return {
    google: {
      imageConfig: {
        aspectRatio,
        imageSize: size,
      },
    },
  };
}

function openRouterProviderOptions(
  aspectRatio: ImageAspectRatio,
  size: ImageSizeTier,
) {
  return {
    openrouter: {
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: size,
      },
    },
  };
}

type SourceImage = { bytes: Buffer; mediaType: string };

function editPromptText(prompt: string): string {
  return `Edit this image: ${prompt}`;
}

async function generateFromTextModel(input: {
  provider: ImageProviderId;
  modelId: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSizeTier;
  apiKey: string;
  source?: SourceImage;
}): Promise<CanvasImagePayload & { caption?: string }> {
  const userContent = input.source
    ? [
        {
          type: "image" as const,
          image: input.source.bytes,
          mediaType: input.source.mediaType,
        },
        {
          type: "text" as const,
          text: editPromptText(input.prompt),
        },
      ]
    : input.prompt;

  if (input.provider === "gateway") {
    const gateway = createGateway({ apiKey: input.apiKey });
    const result = await generateText({
      model: gateway(input.modelId),
      ...(input.source
        ? { messages: [{ role: "user" as const, content: userContent }] }
        : { prompt: input.prompt }),
      providerOptions: googleProviderOptions(input.aspectRatio, input.size),
    });
    return {
      ...payloadFromFile(pickImageFile(result.files)),
      caption: captionFromModelText(result.text),
    };
  }

  const openrouter = createOpenRouter({ apiKey: input.apiKey });
  const result = await generateText({
    model: openrouter(input.modelId),
    ...(input.source
      ? { messages: [{ role: "user" as const, content: userContent }] }
      : { prompt: input.prompt }),
    providerOptions: openRouterProviderOptions(input.aspectRatio, input.size),
  });
  return {
    ...payloadFromFile(pickImageFile(result.files)),
    caption: captionFromModelText(result.text),
  };
}

async function generateFromImageModel(input: {
  provider: ImageProviderId;
  modelId: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  apiKey: string;
  source?: SourceImage;
}): Promise<CanvasImagePayload> {
  const prompt = input.source
    ? {
        images: [input.source.bytes],
        text: editPromptText(input.prompt),
      }
    : input.prompt;

  if (input.provider === "gateway") {
    const gateway = createGateway({ apiKey: input.apiKey });
    const result = await generateImage({
      model: gateway.imageModel(input.modelId),
      prompt,
      aspectRatio: input.aspectRatio,
    });
    return payloadFromBase64Image(result.image);
  }

  const openrouter = createOpenRouter({ apiKey: input.apiKey });
  const result = await generateImage({
    model: openrouter.imageModel(input.modelId),
    prompt,
    aspectRatio: input.aspectRatio,
  });
  return payloadFromBase64Image(result.image);
}

export async function generateCanvasImage(input: {
  provider: ImageProviderId;
  modelId: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSizeTier;
  apiKey: string;
  source?: SourceImage;
}): Promise<CanvasImagePayload & { caption?: string }> {
  const model = resolveImageModel(input.provider, input.modelId);
  if (!model) {
    throw new Error(`Unknown image model: ${input.modelId}`);
  }

  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");

  if (model.mode === "text") {
    return generateFromTextModel(input);
  }

  return generateFromImageModel(input);
}
