---
version: alpha
name: Cell Forge
description: A practical CKB Cell puzzle presented as a compact crafting workbench.
colors:
  ink: "#142c38"
  muted: "#58717c"
  background: "#e9f0ed"
  surface: "#f8fbf7"
  line: "#b8cac8"
  primary: "#d65837"
  primary-dark: "#a53922"
  focus: "#145e85"
typography:
  sans:
    fontFamily: "Arial, Helvetica, sans-serif"
  mono:
    fontFamily: "Consolas, monospace"
rounded:
  DEFAULT: "14px"
  control: "8px"
spacing:
  page-max: "1160px"
  panel-gap: "18px"
components:
  cell: {}
  button: {}
  panel: {}
---

# Cell Forge Design System

## Overview

This is a workbench for learners to see which CKB-like game Cells are live and which get spent. It is a product surface, not a marketing page. The memorable element is the row of selectable Cells; everything around it stays quiet. It should not resemble a trading dashboard or imply the browser simulation is connected to a wallet.

The UI is English-only. A desktop or phone browser can run the local practice without an account. `DESIGN.md` records the accepted values; `web/style.css` is the runtime owner, with matching `:root` variables. The browser game and the signed local-devnet evidence are visibly separate.

## Colors

Blue-grey ink and pale mineral surfaces make the Cells legible. Rust orange means an actionable selection or forge action, never a transaction confirmation. Focus uses the separate blue `focus` token. High-contrast mode retains visible borders.

## Typography

The system sans stack carries instructions and actions; the mono stack is reserved for turn labels, Cell quantities, and hashes. This keeps technical detail readable without making all copy look like code.

## Layout

The board has a maximum width of 1160px. Ingredient Cells form four columns on wider screens and two columns on narrow screens. The page uses natural vertical scrolling, not a fixed-height game canvas.

## Elevation & Depth

Panels use a border rather than floating shadows. The dark recipe card has one offset shadow as the only decorative depth cue.

## Shapes

Panels use 14px corners and controls use roughly 8–10px corners. Cell borders remain visible in all states; a selected Cell gains a thicker orange border.

## Components

Cell buttons are native buttons. The State Cell is shown but disabled because it is included automatically. Selection is conveyed by border, background, and `aria-pressed`. The forge button is disabled until exactly two ingredients are selected. Invalid recipes leave the board unchanged and explain the problem in a live status region. Reset is always available. Close is available only once the Pickaxe exists; it clears the local practice board.

The history lists consumed and created game Cells. The devnet panel is read-only and links to the full local-chain record. No hash is presented as a public explorer link. Hover, active, focus-visible, disabled, and reduced-motion states are defined in `web/style.css`. There are no icon-only actions or remote-loading states.

## Do's and Don'ts

- Do keep a visible distinction between live Cells, spent Cells in history, and signed-chain evidence.
- Do keep the whole puzzle keyboard-operable with ordinary buttons.
- Don't call browser actions transactions or suggest that a wallet is connected.
- Don't use animation as the only way to communicate a state change.
