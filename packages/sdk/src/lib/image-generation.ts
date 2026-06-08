import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@dddx/cli";

import { api } from "@/client";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type ImageGenerationCatalog = RouterOutputs["image"]["models"];
export type ImageProviderId = ImageGenerationCatalog["providers"][number]["id"];
export type ImageAspectRatio = ImageGenerationCatalog["aspectRatios"][number];
export type ImageSizeTier = ImageGenerationCatalog["sizes"][number];

export type ImageGenerateConfig = {
  provider: ImageProviderId;
  modelId: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSizeTier;
  prompt: string;
  /** Workspace-relative path of an uploaded reference image (img2img). */
  referencePath?: string;
};

export type ImageGenerationPrefs = {
  provider?: string;
  modelId?: string;
};

export function defaultModelForProvider(
  catalog: ImageGenerationCatalog,
  provider: ImageProviderId,
): string {
  return catalog.models[provider][0]?.id ?? "";
}

export function defaultImageGenerateConfig(
  catalog: ImageGenerationCatalog,
  prefs?: Partial<ImageGenerationPrefs>,
): ImageGenerateConfig {
  const fallbackProvider = catalog.providers[0]!.id;
  const provider: ImageProviderId = catalog.providers.some(
    (p) => p.id === prefs?.provider,
  )
    ? (prefs!.provider as ImageProviderId)
    : fallbackProvider;

  const models = catalog.models[provider];
  const fallbackModel = defaultModelForProvider(catalog, provider);
  const modelId =
    prefs?.modelId && models.some((m) => m.id === prefs.modelId)
      ? prefs.modelId
      : fallbackModel;

  return {
    provider,
    modelId,
    aspectRatio: catalog.aspectRatios[0]!,
    size: catalog.sizes[0]!,
    prompt: "",
  };
}

/** Catalog for image generation UI (providers, models, aspect ratios, sizes). */
export function useImageGenerationCatalog() {
  return api.image.models.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
  });
}
