/** Mirrors `QuestionConfig` / `QuestionOption` in `@dddx/sdk` agent-elements. */
export type QuestionOption = {
  id: string;
  label: string;
  description?: string;
};

export type QuestionConfig = {
  kind: "single" | "multi" | "text";
  title: string;
  description?: string;
  options?: QuestionOption[];
  allowCustom?: boolean;
  customLabel?: string;
  customPlaceholder?: string;
  minSelections?: number;
  maxSelections?: number;
  placeholder?: string;
};

const DECIDE_LABELS = new Set(
  ["decide for me", "explore a few options", "other"].map((s) => s.toLowerCase()),
);

/** Coerce unknown to a plain object (not an array). */
export function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function slugId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `option-${index + 1}`;
}

function normalizeOptionEntry(
  entry: unknown,
  index: number,
): QuestionOption | null {
  if (typeof entry === "string" && entry.trim()) {
    const label = entry.trim();
    return { id: slugId(label, index), label };
  }
  if (typeof entry === "number" || typeof entry === "boolean") {
    const label = String(entry);
    return { id: slugId(label, index), label };
  }
  const rec = asRecord(entry);
  if (!rec) return null;

  const label = firstNonEmptyString(
    rec.label,
    rec.text,
    rec.title,
    rec.name,
    rec.prompt,
    rec.header,
    rec.value,
    rec.description,
  );
  const id =
    firstNonEmptyString(rec.id, rec.value, rec.key) ||
    slugId(label || `option-${index + 1}`, index);
  const display =
    label ||
    (typeof rec.svg === "string" && rec.svg.trim()
      ? `Visual option ${index + 1}`
      : id
        ? id.replace(/[-_]+/g, " ")
        : `Option ${index + 1}`);

  return {
    id,
    label: display,
    ...(typeof rec.description === "string" &&
    rec.description !== display &&
    rec.description !== label
      ? { description: rec.description }
      : {}),
  };
}

function normalizeOptionsList(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => normalizeOptionEntry(entry, index))
    .filter((row): row is QuestionOption => row !== null);
}

function resolveOptionsRaw(item: Record<string, unknown>): unknown {
  if (Array.isArray(item.options)) return item.options;
  if (Array.isArray(item.choices)) return item.choices;
  if (Array.isArray(item.labels)) return item.labels;
  return undefined;
}

function resolveTitle(item: Record<string, unknown>): string {
  return firstNonEmptyString(
    item.title,
    item.question,
    item.prompt,
    item.header,
    item.text,
    item.name,
    item.id,
  );
}

function resolveKind(
  item: Record<string, unknown>,
  options: QuestionOption[],
): QuestionConfig["kind"] {
  const raw = typeof item.kind === "string" ? item.kind.toLowerCase() : "";

  if (raw === "text" || raw === "freeform" || raw === "textarea") return "text";
  if (raw === "multi" || raw === "multiple" || raw === "checkbox") return "multi";
  if (raw === "single" || raw === "radio") return "single";
  if (raw === "text-options" || raw === "svg-options") {
    return item.multi === true ? "multi" : "single";
  }
  if (raw === "slider" || raw === "file") return "text";

  if (item.multi === true) return "multi";
  if (options.length > 0) return "single";
  return "text";
}

/** Unwrap MCP / AI SDK tool `output` (content blocks, JSON strings). */
export function unwrapToolOutput(output: unknown): unknown {
  if (Array.isArray(output)) {
    const text = output
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === "object" &&
          b !== null &&
          Reflect.get(b, "type") === "text" &&
          typeof Reflect.get(b, "text") === "string",
      )
      .map((b) => b.text)
      .join("");
    if (!text) return output;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (
    typeof output === "object" &&
    output !== null &&
    Reflect.get(output, "type") === "text" &&
    typeof Reflect.get(output, "text") === "string"
  ) {
    try {
      return JSON.parse(Reflect.get(output, "text") as string);
    } catch {
      return Reflect.get(output, "text");
    }
  }
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }
  return output;
}

/** Normalize and detect `questions_v2` tool payloads for the studio UI. */
export namespace Questions {
  /** Coerce any agent / MCP question shape into a UI-ready config. */
  export function coerce(raw: unknown): QuestionConfig | null {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const title = resolveTitle(item);
    if (!title) return null;

    const options = normalizeOptionsList(resolveOptionsRaw(item));
    let kind = resolveKind(item, options);

    if (kind !== "text" && options.length === 0) {
      kind = "text";
    }

    if (kind === "text") {
      return {
        kind: "text",
        title,
        ...(typeof item.subtitle === "string"
          ? { description: item.subtitle }
          : {}),
        placeholder: firstNonEmptyString(
          item.placeholder,
          item.customPlaceholder,
          "Type your answer",
        ),
      };
    }

    const allowCustom =
      item.allowCustom === true ||
      options.some((o) => DECIDE_LABELS.has(o.label.toLowerCase())) ||
      kind === "single";

    return {
      kind,
      title,
      ...(typeof item.subtitle === "string"
        ? { description: item.subtitle }
        : {}),
      options,
      allowCustom,
      ...(kind === "multi" && typeof item.min === "number"
        ? { minSelections: item.min }
        : {}),
      ...(kind === "multi" && typeof item.max === "number"
        ? { maxSelections: item.max }
        : {}),
      ...(typeof item.placeholder === "string"
        ? { customPlaceholder: item.placeholder }
        : {}),
    };
  }

  /** Normalize `questions_v2` tool input — never passes through raw payloads. */
  export function normalize(raw: unknown): QuestionConfig[] {
    const input = asRecord(raw) ?? {};
    const list: unknown[] = [];

    if (Array.isArray(input.questions)) {
      list.push(...input.questions);
    } else if (input.question !== undefined) {
      list.push(input.question);
    } else if (Array.isArray(raw)) {
      list.push(...raw);
    }

    const questions: QuestionConfig[] = [];
    for (const item of list) {
      const normalized = coerce(item);
      if (normalized) questions.push(normalized);
    }
    return questions;
  }

  export function form(
    raw: unknown,
  ): { title?: string; questions: QuestionConfig[] } {
    const input = asRecord(raw) ?? {};
    const title = firstNonEmptyString(input.title) || undefined;
    return { title, questions: normalize(raw) };
  }

  export function isTool(toolName: string): boolean {
    const name = toolName.trim();
    if (!name) return false;
    if (name === "questions_v2" || name === "Question") return true;
    if (name.endsWith("__questions_v2")) return true;
    return name.includes("questions_v2");
  }

  export function parse(input: unknown): Record<string, unknown> {
    if (input === undefined || input === null) return {};
    if (typeof input === "object" && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        if (Array.isArray(parsed)) {
          return { questions: parsed };
        }
      } catch {
        return {};
      }
    }
    return {};
  }

  /** Alias for {@link unwrapToolOutput}. */
  export function unwrap(output: unknown): unknown {
    return unwrapToolOutput(output);
  }

  export function isPending(output: unknown): boolean {
    const unwrapped = unwrapToolOutput(output);
    if (!unwrapped || typeof unwrapped !== "object") return false;
    if (Reflect.get(unwrapped, "pending") === true) return true;
    const status = Reflect.get(unwrapped, "status");
    return status === "awaiting_user" || status === "pending";
  }
}
