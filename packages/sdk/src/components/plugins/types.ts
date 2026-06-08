export type PluginKind = "templates" | "themes" | "skills";

export type PluginListItem = {
  plugin: string;
  name: string;
  kind: PluginKind;
  title: string;
  /** Absolute path to the item folder on the user's machine. */
  source: string;
  category?: string;
  preview?: {
    type: "html" | "image" | "markdown" | "video";
    url: string;
  };
  /** Dock panel preview for the eye-button overlay (video > html > image > markdown). */
  previewHtml?: {
    type: "html" | "image" | "markdown" | "video";
    url: string;
  };
};

export type PluginListPack = {
  id: string;
  marketplace: string;
  name: string;
  description?: string;
  author?: { name: string; url?: string };
  homepage?: string;
  license?: string;
  items: PluginListItem[];
};

export type PluginSectionKind = "templates" | "themes" | "skills";
