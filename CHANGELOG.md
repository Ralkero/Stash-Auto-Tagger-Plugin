# Changelog

## 0.6.2 - 2026-07-20

- Linked the scene title beneath Descriptor Review's frame overview directly to the scene's normal Stash playback page.
- Added visible hover and keyboard-focus styling without changing the overview layout.

## 0.6.1 - 2026-07-20

- Added pixel-level quality inspection for the eighteen-frame Scene Overview.
- Rejected near-black, transparent, overexposed-uniform, and otherwise empty storyboard crops.
- Selected the highest-quality usable frame within each timeline region while preserving chronological coverage.
- Avoided filling an overview slot with a rejected frame when fewer than eighteen usable frames exist.

## 0.6.0 - 2026-07-20

- Added a compact Keyboard Shortcuts cheat sheet beneath Save & Next in Descriptor Review.
- Added persistent rebinding for 21 playback, seeking, and review actions, including multi-key combinations.
- Added direct review bindings for Previous, Skip, Save & Next, Not Applicable, and Undo Last Save.
- Added capture feedback, Escape-to-cancel, Delete/Backspace-to-clear, conflict resolution, and Reset Defaults.
- Kept native `0-9` timeline-percentage seeking available and identified separately in the shortcut panel.

## 0.5.4 - 2026-07-20

- Added centered, fading player feedback for keyboard seeks, percentage seeks, overview-frame jumps, and native timeline or scrubber seeks.
- Added `Ctrl+Plus` and `Ctrl+Minus` to increase or decrease the `A`/`D` seek interval by one second.
- Persisted the adjustable seek interval between Descriptor Review sessions, bounded from one to sixty seconds.

## 0.5.3 - 2026-07-20

- Assigned `A` and `D` as the dedicated five-second seek backward and forward shortcuts throughout Descriptor Review.
- Kept ordinary Left/Right seeking at ten seconds and Ctrl/Alt-modified seeking at sixty seconds.
- Expanded Scene Overview from six frames to eighteen evenly distributed frames in three rows of six.

## 0.5.2 - 2026-07-20

- Promoted newly entered descriptor values into the shared category picker immediately.
- Kept custom Sex Acts & Positions and Endings available while moving between scenes and after reopening Descriptor Review.
- Merged descriptor values already saved across the Rule34 library into the appropriate picker vocabulary.
- Preserved explicit Save behavior: adding a vocabulary value does not alter scene metadata until the scene is saved.

## 0.5.1 - 2026-07-20

- Made Stash player keyboard shortcuts work from anywhere on the Descriptor Review page, including after clicking review controls.
- Preserved native Stash seek increments and modifier behavior for arrow keys, playback, mute, fullscreen, loop, volume, percentage seek, and bracket seek shortcuts.
- Removed the conflicting `Alt+Left/Right` scene-navigation override and prevented shortcuts originating inside the player from firing twice.
- Kept descriptor text fields editable while forwarding supported player shortcuts.

## 0.5.0 - 2026-07-20

- Rebuilt Descriptor Review as a native Stash plugin route so it can use Stash's real `ScenePlayer` within the required React and GraphQL contexts.
- Added the normal Stash player controls, playback-rate options, timeline hover thumbnails, markers, source selection, and generated frame scrubber beneath the timeline.
- Added a six-frame Scene Overview sampled from the beginning, middle, and end of Stash's existing VTT storyboard.
- Made overview frames seek the native player when clicked, with timestamp labels and a basic-player fallback if the native component cannot load.
- Kept descriptor Save, Not Applicable, Undo, review progress, and custom-field isolation unchanged.

## 0.4.0 - 2026-07-20

- Added a top-level **Descriptors** navigation entry beside **Characters**.
- Added a dedicated searchable descriptor browser with separate Sex Acts & Positions and Endings sections.
- Added distinct-scene counts for every saved descriptor value.
- Selecting a value now loads matching scenes directly on the Descriptors page using a real server-side custom-field filter.
- Added a two-pane browser with persistent descriptor selection, native Stash scene cards, hover previews, metadata indicators, direct navigation, and 40-scene pagination.

## 0.3.2 - 2026-07-20

- Made the scene-card descriptor count a keyboard-accessible button.
- Clicking the indicator now opens a viewport-aware categorized list of every saved descriptor on the scene.
- Added outside-click, Escape, scroll, resize, route-change, and second-click dismissal.

## 0.3.1 - 2026-07-20

- Added a scene-card descriptor indicator beside the existing metadata counts on the Scenes browsing page.
- The indicator shows the combined unique descriptor count and lists both custom-field categories in its tooltip.
- Batched visible-scene queries avoid one GraphQL request per card.
- Save and Undo now refresh any visible scene-card indicator immediately.

## 0.3.0 - 2026-07-20

- Added a full-screen one-scene-at-a-time Scene Descriptor Review queue.
- Added separate custom-field-backed Sex Acts & Positions and Endings categories.
- Added controlled filename detection for the reviewed Organizer ordering, including compound terms such as `Anal Doggystyle`, `POV Cowgirl`, and `Prone Bone`.
- Added searchable multi-select chips, custom value entry, Save & Next, Skip, Previous, Not Applicable, and field-scoped undo.
- Kept descriptor writes completely separate from Stash Tags/Characters and all unrelated scene metadata.
- Added persistent review progress and Rule34-only discovery with holding-folder exclusions.

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
