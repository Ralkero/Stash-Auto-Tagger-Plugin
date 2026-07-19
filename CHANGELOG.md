# Changelog

## [0.2.2] - 2026-07-19

### Character-Only Tag Guard

- Prevented title fallback from creating a second tag when a known character alias already appears inside the same title segment.
- Restricted unknown character creation to clean atomic names of at most three tokens.
- Rejected action, subtitle, variant, franchise, creator, organization, and collective names before character Tag creation.
- Added regression coverage for the malformed title patterns found during the live Characters hierarchy cleanup.

## [0.2.1] - 2026-07-18

### Browse-Page Teaching

- Added **Apply & Teach Auto-Tagger** beside Stash's Apply button when editing exactly one selected scene from the main scene browser.
- The action first uses Stash's native Apply flow, waits for a successful modal close, and only then previews lessons from the saved metadata.
- Multi-scene bulk edits intentionally do not expose teaching because one correction cannot be mapped safely to several filenames.
- Kept browse-page teaching route-aware so its correction preview closes on navigation and cannot leak into another page.

## [0.2.0] - 2026-07-18

### Human-Taught Corrections

- Added a route-safe **Teach Auto-Tagger** action to scene player pages with rule-by-rule preview and explicit confirmation.
- Added persistent, versioned character aliases, artist aliases, ignored tokens, and high-priority character-to-Studio rules stored through Stash plugin configuration.
- Added a learned-corrections manager with source-scene audit details, target validation, disable, and undo support.
- Added separately confirmed matching-scene repair previews. Repairs re-check scene snapshots and preserve unrelated metadata.
- Renamed the manifest to `scene-auto-tagger.yml`, establishing the stable plugin ID `scene-auto-tagger` while retaining settings-free Stash v0.30.x compatibility.
- Added mocked Tina Armstrong coverage proving a confirmed Dead or Alive lesson outranks an Original Character folder without affecting unrelated scenes.
- Accepted JSON-encoded `scene_ids` in task argument maps so targeted scripted tasks resolve each ID correctly.

## [0.1.28] - 2026-07-18

### Ambiguous Character Names

- Added canonical `Gwen Tennyson` / `Ben 10` mappings while preserving `Gwen Stacy` / `Marvel` for explicit Gwen Stacy filenames.
- Longer character aliases now suppress overlapping short aliases at the same title position, preventing `Gwen Tennyson` from also matching the broad `gwen -> Gwen Stacy` alias.
- Confirmed bare `Raven` remains the Teen Titans character; `Raven (Stellar Blade)` is no longer selected for the affected Redmoa titles.

## [0.1.27] - 2026-07-18

### Safe Missing Character Creation

- Enabled strict title-derived character candidates for the visible bulk task so clean new character names can be created when no matching Stash Tag exists.
- Limited fallback parsing to the first title segment before subtitle dashes while preserving comma, `x`, and `vs` multi-character splitting.
- Allowed fallback under trusted existing creator Groups, including `Original Character` and `Artist OC` paths, while blocking generic title values such as `Operation`, `Succubus`, and `Bunnygirl Catwalk`.
- Added compact existing-tag aliases so filename forms such as `Helenparr` reuse `Helen Parr` instead of creating a duplicate.
- Added `OBJECT_CREATED` log lines for newly created Studios, Groups, and Tags.
- Suppressed raw title fallback under `Rule34 Pictures` and expanded variant/action trimming after a full-library candidate audit.
- Added compact crossover splitting and canonical reuse for forms such as `Jillxclaire`, plus safe canonical aliases for `Brig`, `Fia Baldachin`, and `Yshtola`.

## [0.1.22] - 2026-06-08

### Character Disambiguation

- Prefer the character tag linked to the current Rule34 franchise folder when multiple existing tags share the same base name.
- Prevented same-base cross-franchise double-tagging, such as applying both `Raven` and `Raven (Stellar Blade)` to Stellar Blade scenes.

## [0.1.21] - 2026-06-08

### Full Backlog Runs

- Changed the task button from a bounded 100-scene batch to a high-limit discovery pass intended to process every actionable scene in the configured Rule34 scope.
- Raised discovery page size and scan limits so the task stops because Stash has no more actionable pages, not because the plugin hit a small batch cap.

### Character Inference

- Added safe single-token runtime character aliases for existing Stash tags such as `Pyra`, `Yuna`, `Quiet`, and `Palutena`.
- Added conservative franchise-folder title inference for scenes where the artist/group is known but the character tag is missing.
- Inferred title characters still go through normal existing-tag lookup, compare-before-write, and additive update handling before any tag is created.

## [0.1.20] - 2026-05-30

### Run Visibility

- Added end-of-run user-facing task output summarizing untagged scenes, partially tagged scenes, successfully tagged scenes, Groups/Tags detected, and Groups/Tags added.
- Added detailed per-scene `CSV_ROW` accounting columns for pre-run metadata state, detected Group/Tag counts, missing Group/Tag counts, added Group/Tag counts, and metadata gaps.
- Added `METADATA_GAP` diagnostics when apply-level metadata was detected but could not be fully matched or written.
- Added a final library audit that logs remaining untagged and partially tagged scenes in the configured discovery scope after every task run.

## [0.1.19] - 2026-05-30

### Existing-First Character Matching

- Added safe runtime indexing for top-level, full-name character tags so existing tags such as `Yuffie Kisaragi` can be detected even when they have no aliases.
- Added unique first-name runtime aliases for multi-token character tags, only when the first name is not ambiguous in the scanned Stash tag set.
- Prefer a better descriptive existing tag, such as `Juri Han`, over a short exact helper tag such as `Juri` when close matching finds a safer full-name object.
- Corrected embedded aliases for `Juri Han`, `Aerith Gainsborough`, and `Yuffie Kisaragi`.

## [0.1.18] - 2026-05-28

### Stash-First Matching

- Added conservative close-match reuse before creating missing Studios, Groups, or Tags.
- Added `preferExistingCloseMatches` and `closeMatchMinConfidence`.
- Added explicit `Nodu` -> `NoduSFM` Group alias fallback and close-match support for safe suffix cases such as `SFM`.
- Suspicious fallback Group names such as comma-separated lists and `A x B` titles are no longer created as new Groups.

### Discovery Scope

- The UI task button now defaults discovery to paths containing `Rule34`.
- The UI task button excludes `Regular Porn|Hentai` paths by default.
- Discovery logs include path include/exclude filters and skipped path counts.

## [0.1.17] - 2026-05-28

### Alias Learning

- Added guarded auto-alias learning for matched Stash Studios, Groups, and Tags.
- Added `autoAliasMode` with `off`, `suggest`, and `apply` modes. Core defaults to `suggest`; the UI task button uses `apply`.
- Alias updates are additive only and preserve existing aliases.
- Alias update failures are logged as `ALIAS_UPDATE_FAILED` without aborting scene tagging.

### Discovery And Creation

- Clean `Artist - Title` filenames now produce apply-confidence Group candidates, allowing new creator Groups to be created when `createMissingGroups` is enabled.
- Bulk task logging now includes `autoAliasMode` so task logs clearly show whether alias learning is suggesting or applying.

## [0.1.1] - 2026-05-27

### Safety Fixes

- Changed default `dryRun` from `false` to `true`.
- Reordered processing so dry-run never calls create/update mutations.
- Removed `Scene.Create.Post` from `plugin.yml`.
- Restored the 8 plugin settings in `plugin.yml`.
- Normalized `confidenceThreshold` so `90` and `0.9` both mean 90 percent.
- Prevented review-confidence matches from applying inferred Studio/Group/Character metadata.
- Added `Needs Review` as the only optional real-run action for review-confidence scenes.
- Preserved existing Groups and Tags by unioning current IDs with proposed IDs.
- Preserved existing Studio unless `allowOverwriteExistingMetadata` is true.

### Matching Fixes

- Embedded a runtime alias fallback generated from `aliases.json`.
- Added `characterStudios` support for HydraFXX-style generic folders.
- Extracted artist/group from the basename prefix before dash separators.
- Ignored generic folders such as `Animations`, `HydraFXX`, `Downloads`, and `Rule34` as Studio candidates.
- Normalized alias keys and candidates through the same normalization path.
- Improved handling for punctuation and numeric aliases such as `D.Va`, `2B`, and `A2`.

### Testing

- Replaced duplicated helper tests with tests importing production code.
- Added mocked GraphQL coverage for dry-run mutation safety, review behavior, additive updates, overwrite guard, threshold normalization, args-map handling, alias normalization, and HydraFXX inference.

## [0.1.0] - 2026-05-27

- Initial embedded JavaScript implementation.
