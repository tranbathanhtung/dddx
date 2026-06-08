import type { NextConfig } from "next";

const cors = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
] as const;

const headers = {
  local: [...cors, { key: "Cache-Control", value: "no-store" }],
  versioned: [
    ...cors,
    {
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    },
  ],
  install: [
    { key: "Content-Type", value: "text/plain; charset=utf-8" },
    { key: "Cache-Control", value: "public, max-age=300" },
  ],
};

const assets = ["index.js", "studio.js", "devtools.js"] as const;

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  async headers() {
    if (isDev) {
      return [
        ...assets.map((file) => ({
          source: `/sdk/:version/${file}`,
          headers: [...headers.local],
        })),
        { source: "/install", headers: [...headers.install] },
      ];
    }

    const local = assets.map((file) => ({
      source: `/sdk/local/${file}`,
      headers: [...headers.local],
    }));

    const versioned = assets.map((file) => ({
      source: `/sdk/:version((?!local$)[^/]+)/${file}`,
      headers: [...headers.versioned],
    }));

    return [
      ...local,
      ...versioned,
      { source: "/install", headers: [...headers.install] },
    ];
  },
};

export default nextConfig;
