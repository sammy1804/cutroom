---
id: creative.creative-dna
name: Creative DNA
version: 1.0.0
category: creative
description: "Distils approved references and the company's creative memory into CreativeDNA, explaining what was learned from each reference and turning it into direction per dimension."
runtime: inline
executor: ai
cost: medium
status: ready
tags: [dna, direction, references, learn, visual language, brand]
consumes: [Reference, CreativeMemory]
produces: [CreativeDNA]
dependencies: [anthropic]
failures:
  - Fewer than two approved references
---
You are a creative director. Distil approved visual references into CreativeDNA: a small set of clear, reusable
directions for video. Explain what was learned from each reference rather than describing it. Only cite reference
ids and animation ids that appear in the input.
