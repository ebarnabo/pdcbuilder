---
name: PDC Builder
description: Atelier de projets web — scaffolding, librairies, blueprints et IA locale.
colors:
  p0: "#100e0d"
  p1: "#16130f"
  p2: "#1d1916"
  p3: "#251f1b"
  p4: "#2e2722"
  well: "#0d0b0a"
  text: "#f5efe7"
  text-2: "#c4b6a8"
  text-3: "#95887e"
  accent: "#f0a35e"
  accent-2: "#e06b35"
  ok: "#74c68d"
  err: "#ff6f60"
  info: "#86b4ee"
  ink-on-accent: "#2c1503"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.011em"
  heading:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.032em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "-0.01em"
rounded:
  window: "36px"
  lg: "26px"
  md: "18px"
  sm: "14px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.p3}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "11px 15px"
    height: "42px"
  card:
    backgroundColor: "{colors.p2}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "22px"
---

## Overview

Desktop Electron shell: rail 252px on `--p0`, canvas `--p1`, cards `--p2`. Restrained strategy — one ember accent (`#f0a35e`) for primary actions, live project, and selection. Inter throughout; JetBrains Mono for paths and logs. Motion is state change only (`--ease` / `--ease-out`); no page-load choreography.

Physical scene: a developer at a dim desk, windowed app beside the editor. Dark is required by the ambient, not by “tools look cool.”

## Colors

Four depth planes (`--p0`…`--p4`) plus a dug well for fields. Text ramp: `--text` body, `--text-2` secondary, `--text-3` meta — `--text-3` stays on the ink side so placeholders and hints clear WCAG AA on wells. Accent wash for selection, never as body fill. Semantic `--ok` / `--err` / `--info` for status only.

## Typography

Fixed sizes, not fluid clamp. Section titles ~22px / 700. Card titles 16.5px / 650. Body 14.5px. Meta 12–13px. `text-wrap: balance` on headings. Line length for prose capped near 62ch on card descriptions.

## Elevation

Relief is a 1px top highlight plus a hairline (`--lift`), then `--shadow-1`…`--shadow-3`. No glass cards in the canvas. Floating chrome (menu, toast, chat, console, overlay) may use a short backdrop blur because they sit over live content — not as a card style.

Z-index scale: sticky 10 → console 20 → chat 30 → dropdown 60 → overlay 70 → toast 80 → grain 90.

## Components

Primary button: warm gradient into `--accent`, ink `#2c1503`. Ghost and danger variants share height 38px (32px compact). Fields are inset wells with accent ring + wash on focus. Cards are the project/framework affordance, not a default wrapper for every block. Library groups accordion; they are not nested cards. Modals portal to `document.body`, max-height of the viewport, a single scrolling `.modal-body`. App shell: one scrollport (`.content`); chat and console are overlays with their own contained scroll.

## Do's and Don'ts

Do: keep scroll chaining contained (`overscroll-behavior: contain`); stick section toolbars; collapse long catalogues; bump muted text toward ink until contrast holds.

Don't: bounce/elastic easing on chrome; cream/sand body; side-stripe accents; gradient text; custom scrollbars as decoration (native-thin overlay only, matching the dark well); nested scroll traps; letting the page behind a dialog move.
