---
name: RestroSathi
description: Warm, readable restaurant interfaces in English and Hindi.
colors:
  primary: "var(--color-primary)"
  primary-contrast: "var(--color-primary-contrast)"
  surface: "var(--color-surface)"
  surface-raised: "var(--color-surface-raised)"
  text: "var(--color-text)"
  text-muted: "var(--color-text-muted)"
  border: "var(--color-border)"
  focus: "var(--color-focus)"
  veg: "var(--color-veg)"
  nonveg: "var(--color-nonveg)"
  danger: "var(--color-danger)"
typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "var(--text-4xl)"
    fontWeight: 400
  headline:
    fontFamily: "var(--font-display)"
    fontSize: "var(--text-2xl)"
    fontWeight: 400
  title:
    fontFamily: "var(--font-display)"
    fontSize: "var(--text-xl)"
    fontWeight: 400
  body:
    fontFamily: "var(--font-body)"
    fontSize: "var(--text-base)"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-body)"
    fontSize: "var(--text-sm)"
    fontWeight: 500
rounded:
  sm: "var(--radius-sm)"
  md: "var(--radius-md)"
  lg: "var(--radius-lg)"
spacing:
  unit: "var(--spacing)"
  2: "calc(var(--spacing) * 2)"
  3: "calc(var(--spacing) * 3)"
  4: "calc(var(--spacing) * 4)"
  6: "calc(var(--spacing) * 6)"
  8: "calc(var(--spacing) * 8)"
  10: "calc(var(--spacing) * 10)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-contrast}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 calc(var(--spacing) * 3)"
    height: "var(--size-touch)"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, var(--color-primary) 90%, transparent)"
  button-primary-active:
    backgroundColor: "color-mix(in oklab, var(--color-primary) 80%, transparent)"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  button-ghost:
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-contrast}"
    rounded: "{rounded.md}"
  button-link:
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  search-field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "calc(var(--spacing) * 2) calc(var(--spacing) * 3)"
  category-link-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-contrast}"
    rounded: "{rounded.md}"
    padding: "calc(var(--spacing) * 2) calc(var(--spacing) * 4)"
  menu-tag:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "var(--spacing) calc(var(--spacing) * 2)"
  dish-row:
    textColor: "{colors.text}"
    padding: "calc(var(--spacing) * 6) 0"
---

# Design System: RestroSathi

## Overview

**Creative North Star: "A readable restaurant menu"**

Warm surfaces and terracotta headings give the interface a familiar restaurant character. Regular-weight serif headings distinguish names and sections; system body type keeps controls, status and prices easy to scan. The current visual authority is the implemented public shell and menu, captured after the first real visual work.

The interface uses open space, clear dividers and familiar controls. English and Hindi receive the same hierarchy, and labels and names can wrap. Staff surfaces carry this identity through restrained details and clear controls; expressive customer pages remain subject to their own surface brief.

**Key Characteristics:**

- Warm surfaces, terracotta emphasis and dark readable text.
- Regular serif headings paired with system and Hindi body fonts.
- Flat rows and visible borders rather than decorative elevation.
- Familiar controls, visible keyboard focus and generous touch targets.
- Wrapping bilingual text and contained horizontal navigation.

This document records the current implementation. `src/brand/theme.css` remains the sole authority for token values; the frontmatter and sidecar reference its CSS variables. Route composition belongs in `.impeccable/surfaces/`, and product facts belong in `PRODUCT.md`.

## Colors

The palette combines a warm cream ground, a lighter raised surface, terracotta emphasis and brown text.

### Primary

- **Terracotta** (`--color-primary`) identifies the restaurant, category headings, selected controls, primary buttons and tags.
- **Light contrast** (`--color-primary-contrast`) supplies text on selected and primary surfaces.

### Neutral

- **Warm cream** (`--color-surface`) is the page ground and sticky navigation background.
- **Raised cream** (`--color-surface-raised`) distinguishes fields, secondary controls and tag backgrounds.
- **Dark brown** (`--color-text`) carries names, body text, controls and prices.
- **Muted brown** (`--color-text-muted`) carries supporting descriptions and dietary/spice labels; it also borders the search field and unchecked vegetarian filter.
- **Warm border** (`--color-border`) separates the header, navigation and dish rows, and outlines secondary buttons.

### Semantic colors

- **Focus blue** (`--color-focus`) supplies the global keyboard outline.
- **Vegetarian green** (`--color-veg`) and **non-vegetarian red** (`--color-nonveg`) accompany distinct circle/triangle symbols and written labels.
- **Danger red** (`--color-danger`) identifies sold-out badges, errors and the destructive button variant. Availability text stays explicit.

**The Token Authority Rule.** Use the color variables from `src/brand/theme.css`; do not copy color literals into components or create a second palette in documentation.

## Typography

**Display Font:** `--font-display`: Georgia, "Nirmala UI", serif.

**Body Font:** `--font-body`: system-ui, "Nirmala UI", Mangal, sans-serif.

The regular serif face gives headings and dish names character without competing with the controls. System and Hindi fallbacks keep interface text familiar and avoid a downloaded font dependency.

### Hierarchy

- **Display:** `--text-4xl`, regular weight; the normal menu page title.
- **Headline:** `--text-2xl`, regular weight; category headings and the restaurant name in the public header.
- **Title:** `--text-xl`, regular weight; dish names.
- **Body:** `--text-base`, regular weight and a 1.5 line height; descriptions, search text, public navigation and category links. Prices use medium weight and tabular numerals.
- **Label:** `--text-sm`; dietary/spice information and tags use regular weight, while shared buttons and sold-out labels use medium weight.
- The implemented error heading and placeholder home heading use `--text-3xl`. They do not establish a separate display identity.

**The Bilingual Hierarchy Rule.** Preserve the same hierarchy in both languages; allow names and labels to wrap instead of shrinking Hindi or truncating meaning.

## Layout

The public shell and main content share a centered container capped by `--width-content` (64rem), with horizontal padding of six spacing units. The theme's base unit is `--spacing` (4px); the implementation uses multiples of this token for gaps and section rhythm.

The header wraps its name and navigation instead of squeezing them. Links remain at least `--size-touch` (44px) tall; navigation links also have this minimum width. The language control may grow vertically for longer text. The skip link appears on keyboard focus.

The menu main has eight spacing units of vertical padding. Search/filter controls stack on phones and share a row from the existing `sm` breakpoint (640px). Dish content uses one column below `md` (768px), then two columns with an eight-unit column gap. Names, descriptions, prices and badges wrap within their row.

Category navigation sticks to the viewport top. Only its inner link strip scrolls horizontally; the page must remain free of horizontal overflow at 360px. Category anchors use `--size-menu-offset` as their scroll margin. This menu arrangement is an observed surface pattern, not a required composition for every future screen.

## Elevation & Depth

The implemented public surface has no shadows. Lighter control fills, selected terracotta fills and thin borders establish hierarchy. Dish rows remain on the page ground with bottom dividers; they do not lift on hover. Sticky navigation retains the page background and a bottom border so content remains readable behind it.

**The Flat Surface Rule.** Preserve flat rows and tonal control states in the current public shell and menu; do not add decorative shadows to these components.

## Shapes

Small rounding (`--radius-sm`) belongs to tags and the dietary filter's indicator. Medium rounding (`--radius-md`) belongs to buttons, search fields and category links. Large rounding (`--radius-lg`) belongs to optional dish photographs. Rows themselves are open rectangles divided by a bottom border.

Borders stay thin and readable. The vegetarian icon uses a circle inside a square; the non-vegetarian icon uses a triangle inside a square. Keep those shapes with their labels so dietary meaning survives without color.

## Components

### Buttons

Familiar, compact controls with room for touch and keyboard use. The shared button uses medium rounding, three spacing units of horizontal padding, two units between contents and `--text-sm` at medium weight. Its default minimum height and width are `--size-touch`; even smaller visual variants retain that target.

- **Primary:** terracotta fill and light contrast text; hover and active use the same fill at 90% and 80% opacity.
- **Outline:** warm border and page-ground fill; hover/active use the raised surface.
- **Secondary:** raised fill and dark text; hover and active use that fill at 90% and 80% opacity.
- **Ghost:** transparent at rest, raised fill on hover/active.
- **Destructive:** danger fill with light contrast text; the same 90%/80% hover/active treatment.
- **Link:** terracotta text, underline on hover/active, retained touch target.

All interactive components share the global `--color-focus` outline, with `--focus-width` and `--focus-offset`. Disabled buttons suppress interaction and use 50% opacity; busy buttons show a wait cursor and 70% opacity. Invalid buttons use the danger border/ring. Color transitions use `--duration-base`; reduced motion zeroes the duration through the theme and global stylesheet.

### Inputs / Fields

The menu search uses a visible label, raised background, muted-brown border, medium rounding and body-size text. It spans available width, stays at least one touch target tall, and uses two units of vertical and three units of horizontal padding. The caret uses terracotta and keyboard focus uses the global outline.

### Chips / Tags

Menu tags are static text, with small rounding, raised background, terracotta text and one/two units of vertical/horizontal padding. Sold-out text uses a danger border and medium danger text. Neither pattern behaves like an interactive filter.

### Cards / Containers

The dish component is a flat article with six units of vertical padding and a bottom border. Dietary/spice information appears before the name; description, exact price or named variants and tags follow. Optional photographs fill the row width at a height of 48 spacing units (the implemented 192px), crop with `object-fit: cover`, and use large rounding. Keep missing-photo rows complete without placeholder imagery.

### Navigation

Public navigation uses body-size links, wrapping flex layout, hover/active underlines and the shared focus outline. The restaurant link uses the display font and primary color. The outline language button uses body-size text, wraps, and exposes pending/error feedback.

Category links use body-size text, medium rounding and two/four units of vertical/horizontal padding. The current location uses primary fill and contrast text; other links gain a raised background on hover/active. Active location remains exposed through `aria-current`.

### Vegetarian filter and feedback

The vegetarian switch has a visible square indicator and written label, with medium rounding and a minimum touch height. Checked state uses primary fill, contrast text and a checkmark; unchecked state uses a raised fill and muted border. `aria-checked` carries its state.

Loading and empty/no-results messages remain readable body text with status semantics. Load failure has an alert, a heading and a primary retry button. The same typography, spacing and focus treatment apply to feedback as to the loaded menu.

## Do's and Don'ts

### Do:

- Do use theme variables for colors, spacing, rounding, focus and motion.
- Do keep English and Hindi at the same hierarchy and check long text at 360px.
- Do keep interactive targets at least 44px and preserve visible keyboard focus.
- Do show dietary and availability meaning through text and shapes as well as color.
- Do use `formatINR(paise)` for live prices and let variant labels and prices wrap.
- Do preserve the reduced-motion rules and clear loading, empty, error and retry states.

### Don't:

- Don't copy raw color values or invent palette ramps outside `src/brand/theme.css`.
- Don't truncate important Hindi names or let the page scroll sideways at 360px.
- Don't add hover lift, shadows or click affordances to static dish rows and tags.
- Don't present placeholder imagery as a real dish or invent restaurant facts, proof or claims.
- Don't treat this menu's composition as the required layout for every surface.
