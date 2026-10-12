---
id: research.reference-search
name: Reference Search
version: 1.0.0
category: research
description: "Searches the workspace's saved visual references by words, tags and analysis (style, mood, technique). Free and instant; no AI."
runtime: inline
executor: deterministic
cost: free
status: ready
tags: [reference, search, library, moodboard, similar]
consumes: [Query]
produces: [Reference]
dependencies: [postgres]
failures: []
---
Lexical search over reference titles, tags and stored visual analysis, ranked by relevance score.
