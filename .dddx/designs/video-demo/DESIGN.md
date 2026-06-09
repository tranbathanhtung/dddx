# Daisy Days - DDDX Video Frame Design

## Product
DDDX is a local-first AI design agent that lives in your repo and browser. Tagline: **Design where you code**.

Run `dddx` to start your dev server, open Studio (chat + live preview), prototype in design mode under `.dddx/designs/`, and extend workflows with plugins (themes, templates, skills).

## Frame System
- Unit: 1920x1080 frame.
- Ground: cream or one Daisy Days pastel per frame.
- Composition: one dominant content container per frame.
- Product screenshots: `studio.png`, `design.png`, and `plugins.png` from the live Studio UI.

## Palette
| Role | Hex |
|------|-----|
| Cream | `#F5F0E6` |
| Turquoise | `#7ECDC0` |
| Soft Pink | `#F7C8D4` |
| Butter | `#FDE68A` |
| Mint | `#A8E6CF` |
| Lavender | `#D4A5E8` |
| Peach | `#FFCBA4` |
| Sky | `#A8D8F0` |
| Coral | `#F8635F` |
| Text Dark | `#2D2D2D` |
| Text Muted | `#6B6B6B` |
| White | `#FFFFFF` |

## Typography
- Display: **Fredoka One**, fallback **Fredoka**, weight 600, rounded and chunky.
- Body and meta: **Quicksand**, weights 500/600/700.
- Fredoka is never italic, underlined, or used for body copy.
- Quicksand body is never uppercase.

## Components
- Cards: white fill, 3px charcoal border, 20px or 28px radius, `6px 6px 0 #2D2D2D` shadow.
- Badge pills: butter fill, 3px charcoal border, pill radius, `4px 4px 0 #2D2D2D` shadow.
- Screenshot frames: treated as white sticker cards with a pastel cap and charcoal outline.
- Circle markers: pastel fill, 3px charcoal border, full circle, Fredoka numerals.
- Bullets: outlined butter dots, never glyph bullets.
- Ornaments: hand-drawn SVG/CSS daisies, stars, suns, clouds, and rainbows, 3-7 per frame, cropped at edges.

## Do
- Use cream or one pastel surface per frame.
- Keep coral as a small marker accent only.
- Put white Fredoka headlines with charcoal text-shadow on saturated pastel surfaces.
- Use flat charcoal headlines on cream.
- Keep all shadows hard, bottom-right, and blur-free.
- Use real Studio screenshots (`studio.png`, `design.png`, `plugins.png`) for product proof.

## Don't
- Do not use the old dark mint SaaS system.
- Do not use blurred shadows, gradients, glows, colored borders, or square corners.
- Do not let screenshots become a raw slideshow; always frame and label them inside Daisy Days components.
- Do not invent product metrics or counts beyond decorative step labels and source labels.
