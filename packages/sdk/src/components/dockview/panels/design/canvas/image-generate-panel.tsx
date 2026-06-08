import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  IconArrowUp,
  IconKey,
  IconLogout,
  IconPencil,
  IconPhoto,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

import { TRPCClientError } from "@trpc/client";

import { api } from "@/client";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultImageGenerateConfig,
  defaultModelForProvider,
  useImageGenerationCatalog,
  type ImageAspectRatio,
  type ImageGenerateConfig,
  type ImageProviderId,
  type ImageSizeTier,
} from "@/lib/image-generation";
import { useImageGenerationPrefs, useStudioStore } from "@/store";

import { previewUrl } from "./nodes/factory";
import { fileToBase64 } from "./upload";

export type { ImageGenerateConfig } from "@/lib/image-generation";

type ImageGeneratePanelProps = {
  workspaceId: string;
  config: ImageGenerateConfig;
  onConfigChange: (patch: Partial<ImageGenerateConfig>) => void;
  onGenerated: (result: { path: string }) => void;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  mode?: "create" | "edit";
  sourcePath?: string;
  replacePath?: string;
  onCancel?: () => void;
};

export const ImageGeneratePanel = memo(function ImageGeneratePanel({
  workspaceId,
  config,
  onConfigChange,
  onGenerated,
  busy,
  onBusyChange,
  mode = "create",
  sourcePath,
  replacePath,
  onCancel,
}: ImageGeneratePanelProps) {
  const catalogQuery = useImageGenerationCatalog();
  const catalog = catalogQuery.data;
  const setImagePrefs = useStudioStore((s) => s.image.setPrefs);
  const savedImagePrefs = useImageGenerationPrefs();

  const resolvedConfig = useMemo(
    () =>
      catalog
        ? { ...defaultImageGenerateConfig(catalog, savedImagePrefs), ...config }
        : config,
    [catalog, config, savedImagePrefs],
  );

  const authStatus = api.auth.status.useQuery();
  const setKey = api.auth.setKey.useMutation({
    onSuccess: () => void authStatus.refetch(),
  });
  const removeKey = api.auth.removeKey.useMutation({
    onSuccess: () => void authStatus.refetch(),
  });
  const generate = api.image.generate.useMutation({
    onSuccess: (data) => onGenerated(data),
  });
  const uploadReference = api.project.designs.upload.useMutation();

  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const providerStatus = authStatus.data?.providers[resolvedConfig.provider];
  const providerConfigured = providerStatus?.configured ?? false;
  const providerLabel =
    catalog?.providers.find((p) => p.id === resolvedConfig.provider)?.label ??
    resolvedConfig.provider;

  const models = useMemo(
    () => (catalog ? catalog.models[resolvedConfig.provider] : []),
    [catalog, resolvedConfig.provider],
  );

  useEffect(() => {
    setAuthError(null);
  }, [resolvedConfig.provider]);

  useEffect(() => {
    if (!catalog) return;
    if (models.some((m) => m.id === resolvedConfig.modelId)) return;
    const modelId = defaultModelForProvider(catalog, resolvedConfig.provider);
    onConfigChange({ modelId });
    setImagePrefs({ modelId });
  }, [
    catalog,
    resolvedConfig.modelId,
    resolvedConfig.provider,
    models,
    onConfigChange,
    setImagePrefs,
  ]);

  const onProviderChange = useCallback(
    (provider: ImageProviderId) => {
      if (!catalog) return;
      const modelId = defaultModelForProvider(catalog, provider);
      onConfigChange({ provider, modelId });
      setImagePrefs({ provider, modelId });
      setAuthError(null);
    },
    [catalog, onConfigChange, setImagePrefs],
  );

  const promptForKey = useCallback(async () => {
    const key = window.prompt(
      providerConfigured
        ? `Update API key for ${providerLabel}`
        : `API key for ${providerLabel}`,
    );
    if (!key?.trim()) return;
    setAuthError(null);
    try {
      await setKey.mutateAsync({
        provider: resolvedConfig.provider,
        key: key.trim(),
      });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save API key");
    }
  }, [providerConfigured, providerLabel, resolvedConfig.provider, setKey]);

  const onRemoveKey = useCallback(async () => {
    setAuthError(null);
    try {
      await removeKey.mutateAsync({ provider: resolvedConfig.provider });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to remove API key");
    }
  }, [removeKey, resolvedConfig.provider]);

  const isEdit = mode === "edit";
  const referencePath = resolvedConfig.referencePath;

  const referencePreview = useMemo(
    () =>
      referencePath
        ? previewUrl(workspaceId, referencePath, Date.now())
        : null,
    [workspaceId, referencePath],
  );

  const onReferencePick = useCallback(() => {
    referenceInputRef.current?.click();
  }, []);

  const onReferenceInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setAuthError("Choose an image file for the reference.");
        return;
      }
      setAuthError(null);
      void (async () => {
        onBusyChange?.(true);
        try {
          const { written } = await uploadReference.mutateAsync({
            id: workspaceId,
            files: [
              {
                path: file.name,
                contentBase64: await fileToBase64(file),
              },
            ],
          });
          const path = written[0];
          if (path) onConfigChange({ referencePath: path });
        } catch (e) {
          setAuthError(
            e instanceof Error
              ? e.message
              : "Failed to upload reference image",
          );
        } finally {
          onBusyChange?.(false);
        }
      })();
    },
    [workspaceId, uploadReference, onConfigChange, onBusyChange],
  );

  const onClearReference = useCallback(() => {
    onConfigChange({ referencePath: undefined });
  }, [onConfigChange]);

  const submit = useCallback(async () => {
    const prompt = resolvedConfig.prompt.trim();
    if (!prompt || !workspaceId) return;
    if (isEdit && !sourcePath) return;
    if (!providerConfigured) {
      setAuthError("Add an API key for this provider to generate images.");
      return;
    }
    const imgSourcePath = isEdit ? sourcePath : referencePath;
    setAuthError(null);
    onBusyChange?.(true);
    try {
      await generate.mutateAsync({
        workspaceId,
        provider: resolvedConfig.provider,
        modelId: resolvedConfig.modelId,
        prompt,
        aspectRatio: resolvedConfig.aspectRatio,
        size: resolvedConfig.size,
        ...(imgSourcePath ? { sourcePath: imgSourcePath } : {}),
        ...(replacePath ? { replacePath } : {}),
      });
    } catch (e) {
      const unauthorized =
        e instanceof TRPCClientError && e.data?.code === "UNAUTHORIZED";
      const message =
        e instanceof Error ? e.message : "Image generation failed";
      if (unauthorized || /unauthorized|not authenticated/i.test(message)) {
        setAuthError("Add an API key for this provider to generate images.");
      } else {
        setAuthError(message);
      }
    } finally {
      onBusyChange?.(false);
    }
  }, [
    resolvedConfig,
    generate,
    onBusyChange,
    providerConfigured,
    workspaceId,
    isEdit,
    sourcePath,
    referencePath,
    replacePath,
  ]);

  const pending =
    busy ||
    generate.isPending ||
    setKey.isPending ||
    removeKey.isPending ||
    uploadReference.isPending ||
    catalogQuery.isPending;

  if (!catalog) {
    return (
      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
        Loading models…
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-lg bg-muted/40">
      {isEdit ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Editing {sourcePath}
          </p>
          {onCancel ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-xs"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <IconPhoto className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <NativeSelect
            size="sm"
            className="min-w-0 flex-1"
            value={resolvedConfig.provider}
            onChange={(e) =>
              onProviderChange(e.target.value as ImageProviderId)
            }
            disabled={pending}
          >
            {catalog.providers.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {providerConfigured ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-7 shrink-0"
                disabled={pending}
                title="Update API key"
                onClick={() => void promptForKey()}
              >
                <IconPencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={pending}
                title="Remove API key"
                onClick={() => void onRemoveKey()}
              >
                <IconLogout className="size-3.5" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 shrink-0"
              disabled={pending}
              title="Add API key"
              onClick={() => void promptForKey()}
            >
              <IconKey className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        {authError ? (
          <p className="px-2 text-xs text-destructive">{authError}</p>
        ) : null}
        {!isEdit ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={onReferenceInputChange}
            />
            {referencePreview ? (
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                <img
                  src={referencePreview}
                  alt="Reference"
                  className="size-full object-cover"
                  draggable={false}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-0 top-0 size-5 rounded-none bg-background/80 p-0 hover:bg-background"
                  disabled={pending}
                  title="Remove reference"
                  onClick={onClearReference}
                >
                  <IconX className="size-3" />
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 px-2 text-xs"
              disabled={pending}
              title="Upload reference image"
              onClick={onReferencePick}
            >
              <IconUpload className="size-3.5" />
              {referencePath ? "Replace reference" : "Reference image"}
            </Button>
          </div>
        ) : null}
        <Textarea
          aria-invalid={`${authError ? "true" : "false"}`}
          placeholder={
            isEdit
              ? "Describe how to change this image"
              : referencePath
                ? "Describe what to create from this reference"
                : "Describe what you want to create"
          }
          value={resolvedConfig.prompt}
          onChange={(e) => onConfigChange({ prompt: e.target.value })}
          disabled={pending}
          className="min-h-0 flex-1 resize-none border-0 shadow-button focus-visible:ring-0 bg-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <NativeSelect
            size="sm"
            className="min-w-0 flex-1"
            value={resolvedConfig.modelId}
            onChange={(e) => {
              const modelId = e.target.value;
              onConfigChange({ modelId });
              setImagePrefs({ modelId });
            }}
            disabled={pending}
          >
            {models.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            size="sm"
            className="w-auto shrink-0"
            value={resolvedConfig.aspectRatio}
            onChange={(e) =>
              onConfigChange({
                aspectRatio: e.target.value as ImageAspectRatio,
              })
            }
            disabled={pending}
          >
            {catalog.aspectRatios.map((ar) => (
              <NativeSelectOption key={ar} value={ar}>
                AR {ar}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            size="sm"
            className="w-auto shrink-0"
            value={resolvedConfig.size}
            onChange={(e) =>
              onConfigChange({ size: e.target.value as ImageSizeTier })
            }
            disabled={pending}
          >
            {catalog.sizes.map((s) => (
              <NativeSelectOption key={s} value={s}>
                Size {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            size="icon-sm"
            className="shrink-0 bg-an-send-button-bg hover:bg-an-send-button-bg "
            disabled={pending || !resolvedConfig.prompt.trim()}
            onClick={() => void submit()}
            title={isEdit ? "Apply edit" : "Generate image"}
          >
            <IconArrowUp className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});
