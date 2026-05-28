# Stash Scene Auto-Tagger

Safety-first embedded JavaScript plugin for [Stash](https://github.com/stashapp/stash) that can infer scene metadata from filenames and existing Stash metadata.

It is designed for libraries where filenames often contain a creator name, franchise/source, and character names. The plugin can map those signals to:

- Studio
- Group
- Character tags

The current release targets Stash `v0.30.1` embedded JavaScript plugins.

## Safety First

The plugin is intentionally conservative:

- Core JS default is `dryRun: true`.
- Dry-run performs no create or update mutations.
- Existing groups and tags are updated additively.
- Existing Studio is preserved unless `allowOverwriteExistingMetadata` is explicitly enabled.
- The create hook is not registered.
- The UI task uses bounded discovery and compare-before-write before any update.
- The UI task does not add new `Needs Review` tags by default.
- Successful apply-confidence repairs can remove only the exact `Needs Review` tag while preserving every other tag.

Review the task log before using broad real runs on a large library.

## Installation

1. Copy this folder to your Stash plugins directory as `scene-auto-tagger`.

   Common examples:

   - Windows: `%USERPROFILE%\.stash\plugins\scene-auto-tagger`
   - Linux/macOS: `~/.stash/plugins/scene-auto-tagger`

2. In Stash, open Settings -> Plugins.
3. Click Reload Plugins.
4. Confirm the "Scene Auto-Tagger" plugin appears.
5. Run the "Bulk auto-tag scenes" task from the Stash Tasks page.

## Runtime Metadata Learning

The plugin no longer depends only on hardcoded aliases.

At the start of each task, it builds an in-memory alias index from Stash:

- Studio names and Studio aliases
- Group names and Group aliases
- Tag names and Tag aliases
- Tag parents for character-to-franchise inference

This means many future misses can be fixed inside Stash itself instead of editing the plugin.

Recommended Stash metadata pattern:

- Create or reuse a Studio, for example `Street Fighter`.
- Create or reuse a character Tag, for example `Cammy White`.
- Add useful aliases on that Tag, for example `cammy`.
- Parent the character Tag under a franchise/Studio tag named `Street Fighter` when possible.
- Create or reuse a Group, for example an animator/creator name, and add Group aliases when needed.

Runtime alias precedence:

1. Scripted task `aliases` overrides.
2. Existing Stash object names, object aliases, and tag-parent inference.
3. Embedded fallback aliases from `scene-auto-tagger.js`.
4. Conservative filename fallback.

## Configuration

The manifest is intentionally minimal for Stash `v0.30.1` compatibility. Some Stash builds are picky about plugin settings schemas, so there is no `settings:` block in `plugin.yml`.

Defaults live in `DEFAULT_CONFIG` inside `scene-auto-tagger.js`.

Important defaults:

| Setting | Default | Meaning |
| --- | --- | --- |
| `dryRun` | `true` | Log proposed work without writes. |
| `createMissingStudios` | `true` | Create missing Studios only on real apply-confidence runs. |
| `createMissingGroups` | `true` | Create missing Groups only on real apply-confidence runs. |
| `createMissingTags` | `true` | Create missing character/review Tags only on real runs. |
| `confidenceThreshold` | `0.9` | `90` and `0.9` both mean 90 percent confidence. |
| `characterParentTag` | `Characters` | Parent tag for character tags. |
| `allowOverwriteExistingMetadata` | `false` | Allows replacing an existing Studio only. Groups/tags remain additive. |
| `useRuntimeStashAliases` | `true` | Builds the runtime alias index from Stash metadata. |
| `missReportLimit` | `50` | Maximum sampled `MISS_CANDIDATE` lines emitted during discovery. |

The visible "Bulk auto-tag scenes" task in `plugin.yml` intentionally overrides several defaults so the button performs a bounded real apply pass over incomplete scenes:

- `dryRun: false`
- `addNeedsReviewTag: false`
- `removeNeedsReviewOnApply: true`
- `allowDiscoveredWrites: true`
- `sceneDiscoveryLimit: 100`
- `sceneDiscoveryOnlyIncomplete: true`
- `sceneDiscoveryOnlyActionable: true`
- `sceneDiscoveryRepairNeedsReview: true`

Scripted task calls can still force `dryRun: true`.

Supported task argument shapes:

- `{ config, aliases, scene_ids }`
- `{ args_map: { config, aliases, scene_ids } }`
- direct config keys as a fallback

## Logs And Audit Output

All reliable Stash `v0.30.1` output goes through `console.log`.

Open the specific Stash task log and search for:

- `[scene-auto-tagger]`
- `RUNTIME_ALIAS_INDEX`
- `BULK DISCOVERY`
- `MISS_CANDIDATE`
- `CSV_ROW:`
- `SCENE AUTO-TAGGER FINAL SUMMARY`

`CSV_ROW:` lines are emitted once per processed scene. They include the current metadata IDs and proposed/matched metadata IDs so changes can be audited.

`MISS_CANDIDATE` lines are sampled examples of scenes that discovery still could not tag confidently. Use these to add aliases or parent tags in Stash, then rerun the task.

## Filename Expectations

The parser works best with names like:

```text
Creator Name - Character Name Source Hint [Quality].mp4
Creator Name - Character A x Character B [Quality].mp4
```

The creator before the first dash-like separator is treated as the Group candidate. Title text after the separator is searched for Studio/franchise aliases and character aliases.

Cross-franchise scenes keep all detected character tags. If multiple detected characters map to different franchises and no explicit Studio is present, the plugin infers Studio from the first character mentioned in the title.

## Embedded Alias Fallback

`aliases.json` is the human-editable seed file, but Stash embedded JS may not reliably read adjacent files at runtime. For that reason, the production JS also contains an `EMBEDDED_ALIASES` fallback.

If you maintain fallback aliases manually:

1. Edit `aliases.json`.
2. Sync the same changes into `EMBEDDED_ALIASES` in `scene-auto-tagger.js`.
3. Run a dry-run or a tiny targeted test before a broad real run.

For normal usage, prefer maintaining aliases and parent relationships directly in Stash.

## Verification

The production JS intentionally has no Node.js exports. The basic compatibility check is:

```bash
node --check scene-auto-tagger.js
```

That syntax check does not write to Stash. Runtime behavior should be validated through Stash task logs.

## Compatibility Notes

- Tested against Stash `v0.30.1`.
- Uses Stash embedded JavaScript interface: `interface: js`.
- No Node.js filesystem access is required at runtime.
- No plugin hook is registered by default.

## Disclaimer

This plugin can update metadata in your Stash database. Start with dry-runs or small targeted batches, inspect the task log, and keep regular Stash backups.
