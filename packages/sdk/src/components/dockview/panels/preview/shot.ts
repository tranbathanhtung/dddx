export function shotName(url: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const pathname = (() => {
    try {
      return new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      return "page";
    }
  })();
  const slug = pathname.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "preview"}-${timestamp}.png`;
}
