# Skill: Make a Deck

## When to Use
Invoke this skill when the user wants:
- A slide presentation in HTML
- A pitch deck, conference talk, all-hands, or any multi-slide document
- An interactive deck that can be navigated with keyboard or clicks
- A deck that can be exported to PDF or PPTX

---

## Core Component: `deck_stage.js`

Always call `copy_starter_component` with `kind: "deck_stage.js"` first. Never hand-roll slide scaling, navigation, or the slide counter. The component provides:

- **Auto-scaling**: Fixed 1920×1080 canvas letterboxed via `transform: scale()` to any viewport
- **Navigation**: Keyboard arrow keys, click-to-advance, and optional on-screen arrows
- **Slide counter**: Rendered outside the scaled canvas (always readable)
- **localStorage persistence**: Current slide index survives page refresh
- **PDF export**: `Cmd+P` prints one page per slide
- **Speaker notes**: Reads from `<script type="application/json" id="speaker-notes">` and posts `{slideIndexChanged: N}` to parent automatically
- **`data-screen-label`**: Auto-tagged on every slide (use 1-indexed labels: "01 Title", "02 Agenda")

### Basic HTML structure
```html
<deck-stage>
  <section data-screen-label="01 Title">
    <!-- slide content -->
  </section>
  <section data-screen-label="02 Agenda">
    <!-- slide content -->
  </section>
  <!-- ... -->
</deck-stage>
```

---

## Workflow

1. **Ask questions** (use `questions_v2`):
   - What is the deck about and who is the audience?
   - How many slides, approximately?
   - What's the tone — formal, conversational, bold, minimal?
   - Is there an existing brand, design system, or color palette?
   - Are there images, charts, or data to include?
   - Should speaker notes be included?
   - Export target: PDF, PPTX, or HTML only?

2. **Establish the design system** before writing slides. Commit to:
   - 1–2 background colors (not more)
   - Type scale: display (80–120px), heading (48–72px), body (28–36px), caption (24px min)
   - Color palette from brand or invented with `oklch`
   - Layout vocabulary: how will section headers, content slides, image slides differ?

3. Copy `deck_stage.js`, read it fully.

4. Write a slide outline (titles only) before building content. Show to user for approval.

5. Build slides section by section. Show early.

6. Add Tweaks (theme toggle, font switch) and deliver.

---

## Design Standards

### Typography
- **Minimum 24px** for any text — no exceptions at 1920×1080
- Display text (hero titles): 80–160px
- Heading text: 48–80px
- Body text: 28–40px
- Caption / label: 24–28px
- Fonts: choose from Google Fonts or design system. Avoid Inter, Roboto, Arial, Fraunces.

### Layout System
Define a consistent layout vocabulary up front. Example system:

| Slide type | Background | Layout |
|---|---|---|
| Section header | Brand color (dark) | Large centered type, minimal |
| Content | White / light | Left-aligned heading + content area |
| Full-bleed image | Image | Overlay text if needed |
| Data / chart | White | Title + visual, generous whitespace |
| Quote | Mid-tone | Large pull quote, attribution below |

Use this system to create visual rhythm — alternate between slide types intentionally.

### Content Rules
- **Less is more**: Each slide communicates ONE idea
- No bullet-point walls — use max 3–4 bullets, or break into multiple slides
- Every slide needs a clear visual hierarchy: what do you read first?
- Empty slides are a layout problem, not a content problem — solve with scale and whitespace
- No filler stats, icons, or decorative elements that don't carry meaning

### Visual Variety
- Use background color variation between sections (not every slide)
- Full-bleed image slides where imagery is central
- Vary between text-dominant and image-dominant slides
- Consistent margins: 80–120px from slide edges

### Colors
- Use design system palette when available
- Maximum 2 background colors across the whole deck
- Accent color used sparingly (CTAs, highlights, key data points)
- Never invent colors from scratch — use `oklch` to derive harmonious values from an existing palette

---

## Slide Labels (Critical)

Slide labels are **1-indexed** and must match what the user sees in the counter:

```html
<section data-screen-label="01 Title">...</section>
<section data-screen-label="02 Problem">...</section>
<section data-screen-label="03 Solution">...</section>
```

When a user says "slide 3", they mean label "03" — not array index [2].

---

## Speaker Notes

Only add speaker notes when the user explicitly requests them.

When adding notes:
- Write in full conversational sentences, as if speaking to an audience
- Include what to say, not just what's on the slide
- Format as a JSON array in a script tag in `<head>`:

```html
<script type="application/json" id="speaker-notes">
[
  "Welcome everyone. Today I want to talk about...",
  "The agenda covers three main areas...",
  "..."
]
</script>
```

Index 0 = slide 1. Array must have the same length as the slide count.

The `deck_stage.js` component posts `{slideIndexChanged: N}` automatically — no extra code needed.

---

## File Structure
```
Deck.html           ← main file using <deck-stage>
deck_stage.js       ← copied starter component
assets/             ← images, logos (copied, not referenced from design system)
```

---

## Export Notes

- **PDF**: Guide user to use `Cmd+P` → Save as PDF. One slide per page.
- **PPTX (editable)**: Invoke **Export as PPTX (Editable)** skill.
- **PPTX (screenshots)**: Invoke **Export as PPTX (Screenshots)** skill.

---

## Companion Files

| File | Purpose |
|---|---|
| `examples/slide-layouts.html` | Visual catalog of 6 ready-to-copy slide layouts: Title/Hero, Section Header, Content+Text, Two-Column, Full-Bleed Image, Data/Stats Grid. Copy any `<section>` into your deck. Requires `deck_stage.js`. |
| `font-pairings.md` | Curated font pairs for all 7 archetypes (Editorial, Brutalist, Organic, Technical, Luxe, Playful, Minimal) with Google Fonts import snippets. |
