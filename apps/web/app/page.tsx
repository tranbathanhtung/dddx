import { Hero } from "@/components/hero";
import { siteDescription, siteTitle } from "@/lib/site-metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
};

export default function Home() {
  return <Hero />;
}
