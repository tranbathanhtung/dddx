import { installScript } from "../../lib/install-script";
import { publicOrigin } from "../../lib/dddx-origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(url.origin);
  const body = installScript(origin);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
