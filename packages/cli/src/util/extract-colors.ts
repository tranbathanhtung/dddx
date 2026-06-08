const HEX = /#([0-9a-fA-F]{3,8})\b/g;
const PAREN_HEX = /\(#([0-9a-fA-F]{3,8})\)/g;
const HSL =
  /hsl\(\s*[\d.]+(?:deg)?[\s,]+[\d.]+%[\s,]+[\d.]+%(?:\s*\/\s*[\d.]+%?)?\s*\)/gi;
const OKLCH = /oklch\(\s*[^)]+\)/gi;
const RGB = /rgba?\(\s*[^)]+\)/gi;

const SEMANTIC_LABELS = [
  "Primary",
  "Background",
  "Accent",
  "Secondary",
] as const;

function expandHex(hex: string) {
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  if (hex.length === 4) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  if (hex.length === 6) return `#${hex}`.toLowerCase();
  if (hex.length === 8) return `#${hex.slice(0, 6)}`.toLowerCase();
  return `#${hex}`.toLowerCase();
}

function normalizeColorKey(color: string) {
  const trimmed = color.trim().toLowerCase();
  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) return expandHex(hex);
  return trimmed.replace(/\s+/g, " ");
}

function firstColorInFragment(fragment: string) {
  const parenHex = fragment.match(PAREN_HEX)?.[0]?.slice(2, -1);
  if (parenHex) return expandHex(parenHex);

  const hex = fragment.match(/#([0-9a-fA-F]{3,8})\b/)?.[0];
  if (hex) return expandHex(hex.slice(1));

  const hsl = fragment.match(HSL)?.[0];
  if (hsl) return hsl;

  const oklch = fragment.match(OKLCH)?.[0];
  if (oklch) return oklch;

  const rgb = fragment.match(RGB)?.[0];
  if (rgb) return rgb;

  return null;
}

function extractSection(text: string, start: RegExp, end: RegExp) {
  const startMatch = text.match(start);
  if (!startMatch || startMatch.index === undefined) return null;

  const from = startMatch.index;
  const rest = text.slice(from + startMatch[0].length);
  const endMatch = rest.match(end);
  const body = endMatch ? rest.slice(0, endMatch.index) : rest;
  return `${startMatch[0]}${body}`;
}

function extractSemanticSwatchColors(text: string) {
  const section =
    extractSection(text, /###?\s*Light Mode/i, /###?\s*Dark Mode/i) ?? text;

  const colors: string[] = [];
  const seen = new Set<string>();

  for (const label of SEMANTIC_LABELS) {
    const line = section
      .split("\n")
      .find((entry) => new RegExp(`\\*\\*${label}\\b`, "i").test(entry));
    if (!line) continue;

    const value = line.split(":").slice(1).join(":").trim();
    const color = firstColorInFragment(value);
    if (!color) continue;

    const key = normalizeColorKey(color);
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(color);
  }

  return colors;
}

function collectColorsFromText(text: string) {
  const colors: string[] = [];
  const seen = new Set<string>();

  const add = (color: string | null | undefined) => {
    if (!color) return;
    const key = normalizeColorKey(color);
    if (seen.has(key)) return;
    seen.add(key);
    colors.push(color.startsWith("#") ? color : color);
  };

  for (const line of text.split("\n")) {
    const parenMatches = [...line.matchAll(PAREN_HEX)];
    if (parenMatches.length > 0) {
      for (const match of parenMatches) add(expandHex(match[1]!));
      continue;
    }

    for (const match of line.matchAll(HEX)) add(expandHex(match[1]!));
    for (const match of line.matchAll(HSL)) add(match[0]);
    for (const match of line.matchAll(OKLCH)) add(match[0]);
    for (const match of line.matchAll(RGB)) add(match[0]);
  }

  return colors;
}

export function extractColorsFromText(text: string, limit = 4) {
  if (!text.trim()) return [] as string[];

  const semantic = extractSemanticSwatchColors(text);
  if (semantic.length >= 2) return semantic.slice(0, limit);

  const lightSection = extractSection(
    text,
    /###?\s*Light Mode/i,
    /###?\s*Dark Mode/i,
  );
  const pool = lightSection ?? text;
  return collectColorsFromText(pool).slice(0, limit);
}

export function extractThemeName(content: string, fallback: string) {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
  const fromFrontmatter = frontmatter
    ?.match(/^name:\s*"?([^"\n]+)"?/m)?.[1]
    ?.trim();
  if (fromFrontmatter) return fromFrontmatter;

  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) {
    return heading.replace(/\s+Design System.*$/i, "").trim() || heading;
  }

  return fallback;
}
