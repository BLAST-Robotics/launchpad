---
name: LaunchPad
description: The Blast Robotics 10989 team portal. Black outlines, a sparing fire gradient, big plain controls for a student on a phone.
colors:
  ember-red: "#e60004"
  ember-red-deep: "#b80003"
  ember-red-wash: "#fff1f0"
  amber: "#fca817"
  amber-wash: "#fff6e3"
  fire-vermilion: "#f03a0c"
  fire-orange: "#f26a0a"
  fire-yellow: "#ffd21f"
  ink: "#0a0a0a"
  paper: "#ffffff"
  graphite: "#55555c"
  hairline: "#e7e7ea"
  hairline-strong: "#c9c9cf"
  success: "#0f7a4f"
  success-wash: "#e8f6ef"
  warning: "#8a4f00"
  warning-wash: "#fff3dc"
  danger: "#b42318"
  danger-wash: "#fdecea"
typography:
  display:
    fontFamily: "Unbounded Variable, Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Unbounded Variable, Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Unbounded Variable, Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
rounded:
  md: "8px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember-red}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ember-red-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  pill-accent:
    backgroundColor: "{colors.ember-red-wash}"
    textColor: "{colors.ember-red-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
---

# Design System: LaunchPad

## Overview

**Creative North Star: "The Launch Sequence"**

LaunchPad is a countdown the student can follow: one clear step, then the next, ending in "you're in". Everything is built so a sixth grader on a phone can read it at arm's length and know what to do. Surfaces are white, edges are black, and the only loud thing is the team's own fire gradient, used as a short strip or a single emphasised word. Controls are large, flat and plain; nothing asks to be admired before it is used.

The identity comes from the team's own artwork, not from the interface. The BLAST wordmark, the shuttle with 10989 and the isometric LaunchPad mark are assets to place, never to redraw. The interface around them stays calm so those marks carry the personality.

**Key Characteristics:**
- White paper, near-black ink, hairline grey borders. Light theme only, because the LaunchPad mark has black outlines.
- One accent red for the primary action; amber is a fill, never text on white.
- A wide, heavy display face (Unbounded) for headings over a friendly geometric body face (Outfit), both self-hosted.
- Big targets: inputs 44px, buttons 40–48px.
- The fire gradient is a brand moment (a 4px strip, one word), not a texture.

## Colors

A restrained palette: black and white do the work, red marks the one thing to press, and the fire stops appear only in the gradient.

### Primary
- **Ember Red** (#e60004): the primary action button, selection highlight, accent borders and pill text on a light wash. White text on it is 4.9:1 (AA).
- **Ember Red Deep** (#b80003): hover state for the primary button, and text on the red wash.

### Secondary
- **Amber** (#fca817): a fill only (progress, gradient stop, soft panels). Never body or small text on white.

### Tertiary (the fire stops)
- **Vermilion** (#f03a0c), **Fire Orange** (#f26a0a), **Fire Yellow** (#ffd21f): exist only as stops of the fire gradient (red, vermilion, orange, amber, yellow). They are not standalone UI colors.

### Neutral
- **Ink** (#0a0a0a): text, outlines, the secondary button's border and hover fill, focus ring.
- **Paper** (#ffffff): page and card surface.
- **Graphite** (#55555c): secondary text.
- **Hairline** (#e7e7ea) and **Hairline Strong** (#c9c9cf): card borders and dividers. Input borders use Graphite instead, because a field edge needs 3:1 against white.
- Status colors (success #0f7a4f, warning #8a4f00, danger #b42318) each with a pale wash; used for pills and alerts only.

### Named Rules
**The One Press Rule.** Ember Red marks the single primary action on a screen. If two things are red buttons, one of them is wrong.
**The Fill, Not Text Rule.** Amber and the yellow end of the gradient never carry small text on white; they are fills, or they sit on black.

## Typography

**Display Font:** Unbounded Variable (with Outfit Variable, then system sans)
**Body Font:** Outfit Variable (with system sans)

**Character:** Unbounded is wide and heavy like the BLAST lettering and gives headings a team-poster stance; Outfit keeps forms and paragraphs friendly and readable.

### Hierarchy
- **Display** (700, 3rem, line-height 1): reserved for a large hero headline. The login H1 uses Headline.
- **Headline** (700, 1.5rem, 1.33): page and card headings.
- **Title** (700, 1.125rem, 1.55): section and step headings.
- **Body** (400, 1rem, 1.5): paragraphs and form text; keep lines to about 65 characters.
- **Label** (500, 0.875rem, 1.43): buttons, field labels, pills. Small helper text drops to 0.75rem and is Graphite.

### Named Rules
**The Display Is for Headings Rule.** Unbounded is applied to h1–h3 and `.font-display` only; forms, tables and paragraphs stay in Outfit.

## Layout

A single centered column up to 64rem (max-w-5xl), 16px gutters on phones and 24px from the small breakpoint up. Pages stack on a phone and become two columns (about 1.15fr and 0.85fr) from the large breakpoint. Spacing follows a 4px base with 12, 16 and 24px as the working rhythm; gaps inside a card are 12 or 16px, between cards 24px. Tap targets stay at least 44px; at 375px width nothing scrolls horizontally.

## Elevation & Depth

Mostly flat and drawn with lines: hairline borders define surfaces, and depth is a single soft card shadow. Nothing lifts on hover except a color change.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(10 10 10 / 0.05), 0 8px 24px -12px rgb(10 10 10 / 0.12)`): resting cards only.

### Named Rules
**The Flat Until Held Rule.** Controls have no shadow. Only cards carry the one ambient shadow.

## Shapes

Soft corners, no sharp ones: 8px on buttons and inputs, 16px on cards, 24px on the black hero panel, full pills for status tags. The logo's rounded black outline is the reference for how heavy lines can feel; interface borders stay a hairline (1px) with the 2px ink focus ring as the one thick line.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Primary:** Ember Red fill, white text, label type, 40px high (48px for the main call to action), 16px side padding. Hover darkens to Ember Red Deep. Disabled drops to 60% opacity.
- **Secondary:** white with a near-black 1px border; hover flips to an ink fill with white text.
- **Ghost:** transparent, Graphite text; hover adds a pale grey wash and ink text.
- **Focus:** 2px ink outline, 2px offset, on every interactive element.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Paper with a Hairline border and the Card shadow.
- **Fire bar (optional):** a 4px full-width fire-gradient strip on the top edge for the main card of a screen.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** 44px high, 8px radius, Graphite border (7.4:1, so the field edge reads on white), Paper fill, 12px side padding, Graphite placeholder.
- **Focus:** the border turns Ember Red and the 2px ink outline appears.
- **Error:** a field error sits under the field with an alert icon and Danger text, linked by `aria-describedby`, and the field gets `aria-invalid` and a Danger border. A form-level problem is a Danger Wash box with a 1px Danger border (40%), an alert icon and Danger text. Both name the field and what to fix, and focus moves to the first failing field.

### Pills
- **Style:** full-round, 1px border, label type, a pale wash with its matching deep text: neutral, accent, success, warning, danger.

### Brand Mark
The LaunchPad isometric three-layer mark at 36px high beside the product name, in the header. Placed from `/logo-mark.svg`; never redrawn.

## Do's and Don'ts

### Do:
- **Do** keep red for the one primary action per screen and white text on it (4.9:1).
- **Do** use the fire gradient as a 4px strip or a single emphasised word.
- **Do** use the team's real wordmark and shuttle images from `public/brand/`.
- **Do** keep controls at least 44px tall on phones and show the 2px ink focus ring everywhere.
- **Do** put amber on black or use it as a fill, and keep status colors paired with words, not color alone.

### Don't:
- **Don't** redraw, recolor or stretch the BLAST wordmark, the shuttle or the isometric mark.
- **Don't** set small text in amber or yellow on white.
- **Don't** put gradient text on paragraphs, buttons or labels.
- **Don't** add a dark theme without reworking the LaunchPad mark, whose outlines are black.
- **Don't** introduce a third accent hue; vermilion, orange and yellow live only inside the gradient.
