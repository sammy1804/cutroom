---
id: research.visual-reference-capture
name: Visual Reference Capture
version: 1.0.0
category: research
description: "Opens an approved website in a real browser, renders and screenshots it, analyses composition, colour, typography and motion, crops the most useful sections and saves them as ranked, reference-only items."
runtime: job
executor: hybrid
cost: medium
status: ready
tags: [browser, screenshot, reference, website, moodboard, visual, composition, playwright]
consumes: [URL, Brief]
produces: [Reference, VisualAnalysis]
dependencies: [playwright, chromium, anthropic.vision]
failures:
  - Site not in the Source Registry or a project's own domain
  - Site blocks automated browsers or requires login (common for Pinterest, Behance)
  - Page takes longer than 30s to load
---
You are an art director doing visual research for a video campaign. Analyse rendered web pages as design
references: composition, colour, typography, motion, art direction, photography. You learn direction from them;
you never copy them. Be concrete and visual. Rank by usefulness for the brief and explain why.
