import type { Metadata } from "next";

import { production } from "./dddx-origin";

export const siteName = "dddx";

export const siteTitle = "Design where you code";

export const siteDescription =
  "An AI design agent that lives in your repo and browser. Works with your favorite coding agent — open-source Claude Design and Google Stitch.";

export const siteMetadata: Metadata = {
  metadataBase: new URL(production),
  title: {
    default: `${siteName} — ${siteTitle}`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "dddx",
    "AI design",
    "design agent",
    "local-first design",
    "design in repo",
    "Cursor",
    "Claude Code",
    "OpenCode",
    "Codex",
    "open source design",
    "Claude Design",
    "Google Stitch",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName,
    title: `${siteName} — ${siteTitle}`,
    description: siteDescription,
    images: [
      {
        url: "/hero-bg.png",
        width: 1200,
        height: 630,
        alt: "dddx — Design where you code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${siteTitle}`,
    description: siteDescription,
    images: ["/hero-bg.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};
