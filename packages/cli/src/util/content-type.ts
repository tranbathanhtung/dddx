/** Infer Content-Type from a file path extension. */
export function contentTypeFromPath(asset: string): string {
  if (asset.endsWith(".html")) return "text/html; charset=utf-8";
  if (asset.endsWith(".js") || asset.endsWith(".mjs"))
    return "text/javascript; charset=utf-8";
  if (asset.endsWith(".css")) return "text/css; charset=utf-8";
  if (asset.endsWith(".json")) return "application/json; charset=utf-8";
  if (asset.endsWith(".svg")) return "image/svg+xml";
  if (asset.endsWith(".webp")) return "image/webp";
  if (asset.endsWith(".png")) return "image/png";
  if (asset.endsWith(".gif")) return "image/gif";
  if (asset.endsWith(".jpg") || asset.endsWith(".jpeg")) return "image/jpeg";
  if (asset.endsWith(".mp4")) return "video/mp4";
  if (asset.endsWith(".webm")) return "video/webm";
  if (asset.endsWith(".mov")) return "video/quicktime";
  if (asset.endsWith(".ogv")) return "video/ogg";
  if (asset.endsWith(".m4v")) return "video/x-m4v";
  if (asset.endsWith(".woff2")) return "font/woff2";
  if (asset.endsWith(".woff")) return "font/woff";
  if (asset.endsWith(".md") || asset.endsWith(".markdown"))
    return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}
