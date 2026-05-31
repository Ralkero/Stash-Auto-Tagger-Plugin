# Changelog

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
