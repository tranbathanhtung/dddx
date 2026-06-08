import { studioProjectSlug } from "@/lib/project-path";

export const useDir = () => {
  const slug = studioProjectSlug();
  return { slug, dir: null as string | null };
};
