---
version: alpha
name: "CKB Cell Inspector"
description: "A read-only technical ledger for tracing CKB transaction capacity."
colors:
  primary: "#102b3f"
  accent: "#1e8eba"
  background: "#e8eef4"
  surface: "#ffffff"
  muted: "#547085"
  warning: "#f1b36c"
typography:
  sans:
    fontFamily: "Segoe UI, sans-serif"
  mono:
    fontFamily: "Cascadia Code, Consolas, monospace"
rounded:
  DEFAULT: "8px"
  card: "9px"
  panel: "12px"
spacing:
  page-max: "1240px"
  section-gap: "28px"
components:
  button: {}
  card: {}
  form: {}
  capacity-rail: {}
---

# CKB Cell Inspector Design System

## Overview

The reference is an engineer's ledger: quiet blue paper, dark ink, and one capacity-flow rail. The user is a CKB learner or builder who wants to inspect a public transaction, not manage a wallet. English is the only UI locale. The page is a product utility, not a promotional landing page. `public/styles.css` is the implemented source of truth; this file records its choices.

## Colors and typography

The light `#e8eef4` canvas and white Cell cards separate the lookup from its results. Deep navy `#102b3f` anchors the title and capacity panel. Blue `#1e8eba` is interactive; amber `#f1b36c` calls out the fee. Segoe UI carries labels and prose. Cascadia Code is reserved for hashes and Cell metadata. No decorative gradients or dark-mode claim.

## Layout and components

The page is at most 1240px wide. The lookup has network, hash, and submit controls in one row on wide screens and stacks below 760px. Results put spent and new Cells in paired columns; mobile stacks them. The flow rail is the one expressive component and is backed by numeric totals. Cards use 9px corners and restrained borders; the main panel uses 12px. Native network selection and semantic form controls remain familiar.

Empty, loading, invalid-hash, missing-transaction, partial-data, and successful states are explicit. Keyboard focus is visible. Loading disables the submit button; reduced-motion users do not get a rotating spinner. The viewer never signs or submits a transaction.
