---
version: alpha
name: Living Passport
description: A working record for a second-hand laptop, styled like a careful repair bench rather than an NFT marketplace.
colors:
  ink: "#172b38"
  muted: "#526773"
  background: "#e8eef0"
  surface: "#f8fbfb"
  line: "#b5c4ca"
  primary: "#245f91"
  accent: "#cb6d3e"
  focus: "#0d78aa"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
  utility:
    fontFamily: "Consolas, 'Courier New', monospace"
rounded:
  DEFAULT: "12px"
  control: "7px"
spacing:
  page-max: "1180px"
  gutter: "24px"
components:
  passport: {}
  timeline: {}
  form: {}
---

# Living Passport design system

## Overview

The audience is someone checking or updating the history of a second-hand laptop. The page's job is to show the current owner, explain the provenance of every event, and let someone prepare a local draft of the next step. The visual reference is a repair-bench service sheet with a device silhouette, not a token marketplace or a crypto dashboard.

## Colors

Steel-blue surfaces echo equipment labels. Cobalt identifies controls, while copper identifies the currently inspected lifecycle event. Neither color means a transaction is confirmed. A persistent local-draft label communicates that boundary in words.

## Typography

Georgia is reserved for the device title. Arial carries instructions and forms; monospace is only for hashes, sequence numbers and diagnostic labels.

## Layout

The broad screen pairs a device/service card with a lifecycle column. A narrow screen stacks them. The event rail is a true sequence, so its order and numbers carry meaning. Natural document scrolling is the only vertical scroll owner.

## Elevation & Depth

Cards rely on borders and a quiet inner highlight. The exploded laptop illustration is the one expressive treatment; event changes animate its parts briefly while the text remains readable without motion.

## Shapes

12px panels and 7px controls balance a precise service-workflow feel with touch usability. Device lines stay sharp enough to resemble a technical drawing.

## Components

Native buttons and labelled fields handle all actions. Errors stay inline and focus returns to the relevant form. The timeline uses ordinary buttons with visible selected states. No browser-native alert, prompt or confirm is used. Reduced-motion users see the same information without movement.

## Do's and Don'ts

- Do distinguish local drafts, CKB-VM contract tests and actual chain transactions.
- Do show who *entered* a repair note without claiming the physical work was verified.
- Don't call a local action minted, signed or on-chain.
