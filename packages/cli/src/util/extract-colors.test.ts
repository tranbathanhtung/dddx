import { expect, test } from "bun:test";

import { extractColorsFromText, extractThemeName } from "./extract-colors";

const metaSnippet = `
### Light Mode: Stark Canvas
- **Background (Canvas White)**: \`hsl(0 0% 100%)\` (#ffffff)
- **Primary (Cobalt)**: \`hsl(220 100% 50%)\` (#0055ff)
- **Accent Background**: \`hsl(216 15% 95%)\` (#f0f2f5)
- **Secondary (Soft Cloud)**: \`hsl(210 10% 96%)\` (#f5f6f7)
`;

test("extractColorsFromText prefers semantic light-mode tokens", () => {
  const colors = extractColorsFromText(metaSnippet);
  expect(colors).toEqual(["#0055ff", "#ffffff", "#f0f2f5", "#f5f6f7"]);
});

test("extractColorsFromText falls back to regex scan", () => {
  const colors = extractColorsFromText(
    "Palette: #112233, hsl(200 40% 6%), oklch(0.5 0.2 260)",
  );
  expect(colors).toEqual(["#112233", "hsl(200 40% 6%)", "oklch(0.5 0.2 260)"]);
});

test("extractThemeName reads markdown heading", () => {
  expect(
    extractThemeName("# Meta Hardware Design System Style Specification", "Meta"),
  ).toBe("Meta Hardware");
});
