---
id: library.harvest-polyhaven
name: Harvest Poly Haven
version: 1.0.0
category: library
description: "Syncs Poly Haven's CC0 textures and HDRIs into the open library through the official public API. Deterministic, incremental (skips items whose files_hash is unchanged), no API key."
runtime: job
executor: deterministic
cost: free
status: ready
tags: [library, harvest, polyhaven, texture, hdri, background, cc0, sync]
consumes: []
produces: [LibraryItem]
dependencies: []
failures: [SOURCE_UNREACHABLE, EMPTY_INDEX]
---
# Harvest Poly Haven

Reads `GET https://api.polyhaven.com/assets?type=textures|hdris` with a unique user agent, as Poly Haven's terms
require, and normalises each asset into a `library_item` with:

- name, description, top-level category, tags (tags + categories, lowercased)
- thumbnail from `cdn.polyhaven.com`
- popularity (`download_count`), max resolution and attributes as features
- `files_hash` as the source version, so unchanged items are skipped on the next sync
- rights: CC0 1.0, commercial use and modification allowed, no attribution required

Download URLs are **not** fetched during harvest. `/files/{id}` is called only when someone imports the item.

## Licence and terms

- Assets are CC0. Self-hosted copies (what import creates) need no attribution.
- Where content is shown live from the API (the open-library browser), the UI must credit "Poly Haven" visibly.
- Every request sends `Cutroom-Library-Harvester/1.0`.

## Failures

- `SOURCE_UNREACHABLE`: the API returned an error or timed out. Nothing is changed; run again later.
- `EMPTY_INDEX`: the API returned no assets. Treated as an error so a bad response can't retire the whole catalog.
