---
id: library.open-library-search
name: Open Library Search
version: 1.0.0
category: library
description: "Keyword search over the harvested open library (Lottie animations, CC0 textures and HDRIs) by name, tag and category, most popular first. Free and deterministic."
runtime: inline
executor: deterministic
cost: free
status: ready
tags: [library, search, lottie, texture, hdri, emoji, background, sticker]
consumes: [Query]
produces: [LibraryItem]
dependencies: [library.harvest-polyhaven, library.harvest-noto-emoji]
failures: []
---
Matches every query word against the item name, category and tag prefixes. Results include the rights record and the
credit line, so callers can show attribution without another lookup.
