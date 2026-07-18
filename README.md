# Stash Scene Auto-Tagger

Embedded JavaScript plugin for Stash v0.30.1+ that tags selected scenes by:

- franchise -> Studio
- artist/creator -> Group
- featured characters -> Tags under the configured parent tag

This release is safety-first. The core JS defaults to `dryRun: true`, dry-run performs no create/update mutations, review-confidence matches do not apply inferred metadata, groups/tags are additive, and the create hook is not registered. Version `0.2.x` also adds explicit human-taught corrections: fix a scene with Stash's normal editor, preview the proposed lessons, and save only the mappings you intend.

## Installation

1. Put this folder in `%USERPROFILE%\.stash\plugins\scene-auto-tagger`.
2. In Stash, run Settings -> Plugins -> Reload Plugins.
3. Remove an obsolete `plugin.yml` left by any pre-`0.2.0` manual installation. The manifest is now `scene-auto-tagger.yml` so Stash uses the stable plugin ID `scene-auto-tagger`.
4. Confirm the "Scene Auto-Tagger" plugin appears with the two bulk tasks and a **Teach Auto-Tagger** action on scene player pages.

## Why `scene-auto-tagger.yml` Is Minimal

Stash v0.30.1 embedded JS plugins can be picky about `plugin.yml` settings schemas. Earlier versions of this plugin used a detailed `settings:` block with `displayName` and `type` fields; on some v0.30.x builds, that shape can fail YAML unmarshalling and make the plugin disappear after reload.

For compatibility, the manifest is intentionally settings-free:

- no `settings:` block
- no `hooks:` block
- two bulk tasks
- scene-page JavaScript and CSS for reviewed learning
- safe defaults kept in `scene-auto-tagger.js`

This means configuration is not currently driven by the Stash plugin settings UI. The runtime-safe defaults live in `DEFAULT_CONFIG`, and scripted task runs may override them through task args.

## Configuration

Default configuration in `scene-auto-tagger.js`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `dryRun` | `true` | Log proposed work without writes. |
| `createMissingStudios` | `true` | Create missing Studios only on real apply-confidence runs. |
| `createMissingGroups` | `true` | Create missing Groups only on real apply-confidence runs. |
| `createMissingTags` | `true` | Create missing character/review Tags only on real runs. |
| `confidenceThreshold` | `0.9` | `90` and `0.9` both mean 90 percent confidence. |
| `characterParentTag` | `Characters` | Parent tag for character tags. |
| `addNeedsReviewTag` | `true` | On review-confidence real runs, add only `Needs Review`. |
| `removeNeedsReviewOnApply` | `false` | Remove only the exact `Needs Review` tag after apply-confidence metadata is resolved. The UI button overrides this to `true`. |
| `allowOverwriteExistingMetadata` | `false` | Allows replacing an existing Studio only. Groups/tags remain additive. |
| `discoverScenesWhenNoSceneIds` | `true` | Lets the plain UI task button select a bounded page when Stash passes no scene IDs. |
| `sceneDiscoveryLimit` | `10000` | Maximum scenes selected by discovery. |
| `sceneDiscoveryPage` | `1` | Discovery page number. |
| `sceneDiscoverySort` | `id` | Discovery sort field. |
| `sceneDiscoveryDirection` | `DESC` | Discovery sort direction. The task button uses newest IDs first. |
| `sceneDiscoveryQuery` | empty | Optional Stash search query for discovery. |
| `sceneDiscoveryOnlyUnorganized` | `true` | Discovery only selects scenes where `organized=false`. |
| `sceneDiscoveryOnlyIncomplete` | `true` | Discovery only selects scenes missing groups or tags by default. |
| `sceneDiscoveryIncludeMissingStudioOnly` | `false` | Whether a scene with groups/tags but no Studio should be considered incomplete. Kept false to avoid cross-IP scenes looping forever. |
| `sceneDiscoverySkipNeedsReview` | `true` | Discovery skips scenes already tagged `Needs Review` unless repair mode finds apply-level work; targeted `scene_ids` still process normally. |
| `sceneDiscoveryOnlyActionable` | `true` | Discovery only selects scenes where parsing finds an apply-confidence Studio, Group, or character Tag that is not already present. |
| `sceneDiscoveryRepairNeedsReview` | `true` | Existing `Needs Review` scenes may be selected again if new aliases now make them actionable. |
| `sceneDiscoveryPageSize` | `100` | Number of scenes fetched per discovery page. |
| `sceneDiscoveryScanPages` | `50` | Maximum pages scanned to find incomplete scenes. |
| `allowDiscoveredWrites` | `false` | Real writes are blocked for discovered scenes unless this is explicitly true. |
| `useRuntimeStashAliases` | `true` | Build an in-memory alias index from existing Stash Studios, Groups, Tags, tag aliases, and tag parents at task start. |
| `runtimeAliasPageSize` | `250` | Number of Studios/Groups/Tags fetched per alias-index page. |
| `runtimeAliasScanPages` | `40` | Maximum pages scanned per object type for the runtime alias index. |
| `runtimeAliasIncludeTopLevelTagAliases` | `true` | Allows top-level Tags with explicit aliases to be used as character aliases. Parent-linked character tags are always preferred. |
| `autoAliasMode` | `suggest` | `off`, `suggest`, or `apply`. Dry-run always logs suggestions only. The UI task button overrides this to `apply`. |
| `minAutoAliasConfidence` | `0.9` | Minimum candidate confidence before the plugin suggests or applies aliases to matched Stash objects. |
| `autoAliasMaxLength` | `80` | Maximum alias text length the plugin will learn from filenames. |
| `preferExistingCloseMatches` | `true` | Search existing Stash objects and close name matches before creating missing Studios, Groups, or Tags. |
| `closeMatchMinConfidence` | `0.92` | Minimum score for a close existing-object match. Handles safe suffix cases such as `Nodu` -> `NoduSFM`. |
| `sceneDiscoveryPathIncludes` | empty | Optional path allow-list for discovery. The UI button sets this to `Rule34`. |
| `sceneDiscoveryPathExcludes` | empty | Optional path block-list for discovery. The UI button excludes `Regular Porn|Hentai`. |
| `missReportLimit` | `50` | Maximum `MISS_CANDIDATE` lines emitted during discovery for scenes that still cannot be tagged. |

Supported task argument shapes:

- `{ config, aliases, scene_ids }`
- `{ args_map: { config, aliases, scene_ids } }`
- direct config keys as a fallback

The core fallback keeps `dryRun: true`. The `scene-auto-tagger.yml` task button overrides this with flat `defaultArgs` so clicking **Bulk auto-tag scenes** performs a real apply pass over actionable scenes in scope:

- `dryRun: false`
- `addNeedsReviewTag: false`
- `removeNeedsReviewOnApply: true`
- `allowDiscoveredWrites: true`
- `sceneDiscoveryLimit: 10000`
- `sceneDiscoveryOnlyIncomplete: true`
- `sceneDiscoveryIncludeMissingStudioOnly: false`
- `sceneDiscoverySkipNeedsReview: true`
- `sceneDiscoveryOnlyActionable: true`
- `sceneDiscoveryRepairNeedsReview: true`
- `sceneDiscoveryPathIncludes: Rule34`
- `sceneDiscoveryPathExcludes: Regular Porn|Hentai`
- `autoAliasMode: apply`
- `minAutoAliasConfidence: 0.9`
- `preferExistingCloseMatches: true`
- `closeMatchMinConfidence: 0.92`
- `allowTitleFallbackCharacterTags: true`

Scripted calls can still force `dryRun: true`.

## Teaching Corrections

From a scene player page:

1. Open an incorrectly tagged scene.
2. Use Stash's normal editor to set the correct Studio, Groups, and character Tags, then save the scene.
3. Click **Teach Auto-Tagger** above the scene details.
4. Review each proposed mapping. Ambiguous multi-character or multi-Group cases require an explicit selection.
5. Select **Save selected lessons**.
6. Optionally select **Preview matching repairs** and confirm the exact existing scenes to repair.

From the main scene browser:

1. Select exactly one scene card.
2. Click Stash's pencil button to open **Edit 1 Scene**.
3. Correct the Studio, Groups, and character Tags.
4. Click **Apply & Teach Auto-Tagger** beside Stash's Apply button.
5. The plugin lets Stash save the edit first, then opens the same reviewed lesson preview.

The teaching action is intentionally absent from multi-scene bulk edits. A learned relationship must come from one corrected filename and one authoritative scene.

Lessons are stored in Stash plugin configuration under `learnedCorrectionsV1`. Each rule records stable object IDs, names, the source scene, timestamps, revision, and replacement history. The **Learned Corrections** manager can disable a rule or undo the latest teaching event.

Teaching never creates a Studio, Group, or Tag. A target deleted from Stash is ignored at runtime and reported as invalid in the manager. Normal tagging remains additive. Only the separate, explicitly confirmed repair operation may replace the exact old Studio or remove the exact wrong Group/Tag produced by the superseded inference; unrelated metadata is preserved.

For example, after correcting a Tina Armstrong scene to `Dead or Alive`, teaching it records a character-to-Studio rule. That learned rule outranks an `Original Character` folder for future Tina scenes without redefining that folder for unrelated files.

## Alias Data And Runtime Learning

The embedded JS runtime does not reliably read adjacent files, so `scene-auto-tagger.js` includes an embedded alias fallback generated from `aliases.json`.

As of `0.1.18`, the plugin builds a runtime alias index from Stash itself at the start of each task. It reads existing Studios, Groups, Tags, Tag aliases, and Tag parents. This means many future misses can be fixed inside Stash metadata instead of editing the plugin.

The plugin can also learn high-confidence aliases back into Stash object metadata. In default core config this is suggestion-only. The visible UI task button sets `autoAliasMode: apply`, so after a successful apply-confidence match the plugin may add the detected filename token as an alias on the matched Studio, Group, or Tag. Alias updates are additive only. Existing aliases are preserved, and alias update failures are logged without aborting the scene metadata update.

The visible scene task also enables strict title fallback for missing character Tags. Fallback reads only the first character segment before subtitle dashes, requires a franchise folder or trusted existing creator Group, rejects generic/action-like names, and searches exact names, aliases, compact spellings, and close Stash matches before creating a new Tag under `Characters`. Raw title fallback is disabled under `Rule34 Pictures`, where file naming is variant-heavy; existing aliases can still match there.

Recommended Stash metadata pattern:

- Create or reuse the Studio, for example `Street Fighter`.
- Create or reuse the character Tag, for example `Cammy White`.
- Add character aliases on the Tag, for example `cammy`.
- Parent the character Tag under a franchise/Studio tag named `Street Fighter`, or under the configured `Characters` parent plus a franchise parent when available.
- Create or reuse the Group, for example `AxenAnim`, and add Group aliases when needed.

Clean filenames in the form `Artist - Title.ext` are treated as Group candidates, but Stash is checked first. Exact names, existing aliases, and conservative close matches are preferred before creation. For example, `Nodu - ...` resolves to the existing `NoduSFM` Group instead of creating `Nodu`. Suspicious fallback names such as multi-person lists or `A x B` titles are not created as new Groups. The plugin still does not invent character Tags or Studios from arbitrary title words; unknown title hints are logged as `MISS_CANDIDATE` lines for review.

Runtime alias precedence is:

1. Scripted task `aliases` overrides.
2. Confirmed human-taught corrections.
3. Existing Stash object names, object aliases, and tag-parent inference.
4. Embedded fallback aliases.
5. Conservative filename fallback.

Keep `aliases.json` as the seed/fallback source for known recurring cases that are not represented in Stash metadata yet. If you edit it, sync the same change into the `EMBEDDED_ALIASES` block before relying on that fallback in Stash.

Supported alias sections:

- `studios`: normalized alias -> canonical Studio
- `groups`: normalized alias -> canonical Group
- `characters`: normalized alias -> canonical character Tag
- `characterStudios`: normalized character alias -> canonical Studio, used for HydraFXX-style paths where the folder is generic

Runtime task arguments may pass `aliases` to override or extend the embedded fallback for scripted runs.

## Output And Logs

All plugin-visible output goes through `console.log`, which is the reliable path for Stash v0.30.1 embedded JS. The plugin also defensively attempts runtime-provided helpers such as `runtime.log`, `runtime.logger.info`, `runtime.progress`, `runtime.progress.update`, `runtime.setProgress`, and `runtime.task.setProgress` when they exist.

Where to look:

1. Open Stash.
2. Go to Tasks.
3. Open the specific "Bulk auto-tag scenes" job.
4. Inspect that job's log/output.
5. Search for `[scene-auto-tagger]` and `CSV_ROW:`.

Expected log markers:

- `STARTUP version=0.2.1 mode=embedded-js`
- `RUNTIME_ALIAS_INDEX run=...` with counts for indexed Studios, Groups, Tags, and character-to-Studio links
- `EXISTING_CLOSE_MATCH type=...` when a candidate is resolved to an existing close Stash object before creation
- `ALIAS_SUGGESTION run=...` when dry-run or suggestion mode finds an alias worth adding
- `ALIAS_UPDATED run=...` when apply mode adds aliases to a Stash object
- `ALIAS_UPDATE_FAILED run=...` if Stash rejects an alias update while the scene update continues
- `BULK DISCOVERY run=...` when the UI task supplies no `scene_ids`
- `BULK DISCOVERY RESULT run=...`
- `MISS_CANDIDATE run=...` for sampled scenes that discovery still cannot confidently tag
- `BULK START run=...`
- `BULK SCENE run=... index=N/T scene=...`
- `BULK PROGRESS run=...` every 5 scenes and at the end
- `CSV_ROW: ...` once per processed scene, plus task-level error rows if a bulk failure escapes
- `===== SCENE AUTO-TAGGER FINAL SUMMARY run=... =====` as the last loud summary line

## Safety Model

For every scene, the plugin:

1. Fetches fresh scene state by ID.
2. Parses path, basename, title, and details.
3. Resolves candidates through normalized aliases.
4. Computes per-field confidence.
5. Stops on low confidence.
6. Stops on review confidence unless adding the `Needs Review` tag on a real run.
7. Performs find-only lookups during dry-run.
8. Reuses existing character tags by exact name, even if they are top-level rather than under `Characters`.
9. Creates missing objects only after dry-run and review gates pass.
10. Optionally suggests or applies additive aliases to matched Stash objects.
11. Builds final assignments additively.
12. Compares final assignments to current state before `sceneUpdate`.

Existing groups and tags are never removed by this plugin. Existing Studio is preserved unless `allowOverwriteExistingMetadata` is true.

## Hook Status

`Scene.Create.Post` is intentionally not registered in `scene-auto-tagger.yml`.

The source still contains a defensive `onSceneCreateHook` function that forces `dryRun: true`, but Stash will not call it unless someone manually re-adds the hook to the manifest. Do not enable hooks until bulk dry-run and small real-write passes are clean.

## Running Safely

The plain Tasks UI button launches the plugin with manifest `defaultArgs`. In this release, the button is an apply action:

- default limit: `10000`
- default filter: `organized=false`
- default discovery: scenes missing groups or tags that also have apply-level candidate work
- default review handling: do not add new `Needs Review` tags from the button
- default repair handling: revisit existing `Needs Review` scenes when aliases can resolve real metadata, then remove only the `Needs Review` tag
- default sort: stable `id DESC`, so newly added incomplete scenes are reached first
- default path scope: only paths containing `Rule34`, excluding `Regular Porn` and `Hentai`
- default write behavior: real apply with additive metadata updates
- default alias learning: apply high-confidence filename aliases back onto matched Stash objects

This makes the UI task button useful without a separate GraphQL call. Safety still comes from the bounded batch size, actionable-scene discovery, Rule34 path scoping, Stash-first object matching, dry-run gates in scripted runs, additive updates, compare-before-write, exact-name `Needs Review` cleanup, and no hook registration. Clean artist names before the first dash-like separator can become Group candidates, but existing Stash Groups and close matches are preferred before any new Group is created.

Cross-franchise scenes keep all detected character tags. If multiple detected characters map to different franchises and no explicit Studio is present in the title, the plugin infers Studio from the first character mentioned in the scene title.

Character matching prefers the longest exact phrase at a title position. For example, `Gwen Tennyson` resolves only to the Ben 10 character instead of also triggering the shorter `gwen -> Gwen Stacy` alias; bare `Raven` remains mapped to Teen Titans unless the title explicitly names another canonical Raven.

Zelda aliases resolve to the existing `Legend of Zelda` Studio name.

AxenAnim aliases now cover the known missed Paragon, Teen Titans, The Witcher, and Street Fighter clips: Countess, Starfire, Raven, Shani, Cammy White, and Chun-Li.

Start with a small set of known scenes:

1. Use scripted `dryRun: true` for a preview when testing new aliases.
2. Use the UI "Bulk auto-tag scenes" button for a bounded real apply pass after aliases are trusted.
3. Open Tasks -> the specific job log.
4. Inspect `[scene-auto-tagger]` and `CSV_ROW:` lines.
5. In dry-run logs, confirm no creates or updates occurred.
6. For UI button runs, confirm any real updates are the expected additive Studio/Group/Tag assignments.
7. Re-run the same tiny batch and confirm already-compliant/no-op behavior.

Example GraphQL shape:

```graphql
mutation {
  runPluginTask(
    plugin_id: "plugin"
    task_name: "Bulk auto-tag scenes"
    args_map: {
      scene_ids: ["1", "2", "3"]
      config: { dryRun: true, confidenceThreshold: 90 }
    }
  )
}
```

## Verification

Because the production JS intentionally has no Node.js exports, the primary compatibility check is:

```bash
node --check scene-auto-tagger.js
node --check ui/scene-auto-tagger-learning.js
node verify_scene_auto_tagger_learning.mjs
```

That syntax check does not write to Stash. Real behavior should be validated through Stash dry-run task logs.

## CSV Audit Schema

The plugin emits one `CSV_ROW:` per scene with 23 columns:

`timestamp,run_id,mode,hook_type,scene_id,scene_title,scene_path,current_studio_id,current_group_ids,current_tag_ids,detected_studios,detected_groups,detected_characters,matched_studio_id,matched_group_ids,matched_tag_ids,confidence_studio,confidence_group,confidence_character_tags,final_confidence,action_taken,result,error`

Fields are CSV-escaped consistently.

If an uncaught task-level error occurs, the bulk task emits a task-level `CSV_ROW:` with `action_taken=task_error` and `result=error`, then emits the final summary line.

## Rollback

Use the `current_*` columns from the CSV rows to restore prior values with a manual `sceneUpdate` if needed. For auto-created Studios/Groups/Tags, check usage first and delete only when safe.
