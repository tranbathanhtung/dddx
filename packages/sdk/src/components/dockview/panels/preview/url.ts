export function normUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(withScheme).href;
  } catch {
    return null;
  }
}

export function sameUrl(a: string, b: string) {
  const left = normUrl(a);
  const right = normUrl(b);
  return left !== null && right !== null && left === right;
}
