# Handover - Scene Auto-Tagger Human-Taught Corrections

## Current State

- Plugin version is `0.2.2`.
- The manifest is `scene-auto-tagger.yml`, giving the plugin the stable ID `scene-auto-tagger` instead of the legacy generic ID `plugin`.
- The manifest remains settings-free for Stash v0.30.x compatibility; defaults live in `DEFAULT_CONFIG` inside `scene-auto-tagger.js`.
- There is no registered `hooks:` block; `Scene.Create.Post` remains disabled by default.
- `dryRun` defaults to `true`.
- Dry-run performs no create/update mutations.
- Review-confidence matches do not apply inferred Studio/Group/Character metadata.
- Groups and tags are updated additively.
- Existing Studio is preserved unless `allowOverwriteExistingMetadata` is true.
- Embedded aliases are available at runtime; `aliases.json` remains the human-editable source of truth.
- At task start, the plugin now builds a runtime alias index from existing Stash Studios, Groups, Tags, Tag aliases, and Tag parents. This lets many future misses be fixed by editing Stash metadata rather than plugin code.
- Runtime alias precedence is scripted `aliases` overrides, confirmed human-taught corrections, Stash object names/aliases and tag-parent inference, then embedded fallback aliases.
- Scene player pages expose **Teach Auto-Tagger** and **Learned Corrections** actions. Teaching is explicit, previewed, revision-checked, persisted through `configurePlugin`, and reversible.
- Main browse-page `Edit 1 Scene` modals expose **Apply & Teach Auto-Tagger**. The action saves through Stash first; multi-scene edits intentionally do not expose teaching.
- Learned character-to-Studio rules outrank folder inference. This supports corrections such as Tina Armstrong -> Dead or Alive without globally remapping the `Original Character` folder.
- Matching existing-scene repairs are a separate preview/apply operation. They can remove only metadata directly attributed to a superseded prediction and preserve every unrelated object.
- Before creating missing Studios, Groups, or Tags, the plugin now searches existing Stash objects for exact names, aliases, and conservative close matches. This prevents cases like `Nodu` creating a duplicate Group when `NoduSFM` already exists.
- The UI task button now sets `autoAliasMode=apply`. After an apply-confidence match succeeds, the plugin can add high-confidence filename aliases onto the matched Stash Studio, Group, or Tag. These alias updates are additive and failures are logged without aborting scene tagging.
- Core defaults keep `autoAliasMode=suggest`, so dry-runs and scripted default runs log `ALIAS_SUGGESTION` lines instead of writing aliases.
- Character Tags parented under a Studio/franchise tag can infer Studio automatically when that parent name matches an existing Studio or known Studio alias.
- Discovery emits sampled `MISS_CANDIDATE` lines for scenes that still cannot be confidently tagged. Use these lines to decide which Stash aliases or parent tags to add next.
- `characterStudios` supports HydraFXX-style franchise inference from known characters.
- Existing top-level character tags are reused by exact name before creating any child tag under `Characters`.
- Alias coverage now includes the high-confidence HydraFXX gaps for Rachel Amber, Harley Quinn, Gwen Stacy, Jill Valentine, Ingrid Hunnigan, Yennefer, Mizora, Wyll, Kara, Clive Rosfield, Bela/Cassandra Dimitrescu, and Ethan Winters.
- User-confirmed HydraFXX mappings now include Ballerina -> Atomic Heart, Mona -> Genshin Impact, Sadako -> The Ring, Witch -> Resident Evil, and Lune -> Expedition 33. Cross-IP scenes keep both character tags and only infer Studio when a single franchise is implied.
- If the UI task supplies no `scene_ids`, the plugin discovers a bounded batch of incomplete scenes.
- Core JS defaults remain dry-run, but the visible task button intentionally overrides them for a bounded real apply pass.
- The visible Stash task button now supplies `defaultArgs` that intentionally run a bounded real apply pass: `dryRun=false`, `allowDiscoveredWrites=true`, `sceneDiscoveryLimit=100`, stable `id DESC` newest-first discovery, and incomplete-scene filtering.
- The visible Stash task button is now path-scoped to `Rule34` and excludes `Regular Porn|Hentai` by default. Targeted `scene_ids` still process whatever scenes were explicitly supplied.
- Bulging Senpai support now includes the `BulgingSenpai` group alias plus Devil May Cry, Uncharted, Lady, Jessie Rasberry, Lightning, Rebecca Chambers, Sheva Alomar, and Elena Fisher mappings. `Bouquetman` is also included as a conservative creator/group alias, with expanded Dead or Alive, Soul Calibur, Tekken, King of Fighters, Street Fighter, Nier, Metroid, Elden Ring, and Nioh character mappings for the current Bouquetman backlog.
- Scripted `config` overrides now take precedence over task `defaultArgs`, so explicit `dryRun: true` cannot be accidentally overridden by the UI task's apply-mode defaults.
- Incomplete-scene discovery selects scenes with no groups or no tags. It does not select scenes that only lack Studio by default, which prevents cross-IP scenes with valid tags from being rediscovered forever.
- Discovery is now candidate-aware by default. The UI button only selects incomplete scenes where parsing finds apply-level work or an apply-confidence cleanup of an existing `Needs Review` tag.
- The UI button sets `addNeedsReviewTag=false`, so it does not create new `Needs Review`-only updates.
- The UI button sets `removeNeedsReviewOnApply=true`, so successful apply-confidence repairs remove only the exact `Needs Review` tag and preserve every other tag.
- Existing `Needs Review` scenes can still be repaired by discovery when aliases make them actionable. Explicit `scene_ids` still process normally.
- Clean artist names before the first dash-like separator are Group candidates, but Stash exact/alias/close matches are preferred before creation. Suspicious fallback names such as comma-separated lists or `A x B` strings are not created as new Groups.
- The broad `cass -> Cassandra Alexandra` alias was replaced with exact phrase aliases for known Soul Calibur filenames plus `aunt cass -> Aunt Cass`/`Pixar` to avoid false positives.
- Cross-franchise scenes now keep all detected character tags and infer Studio from the first character mentioned in the title when character franchises conflict.
- Zelda Studio aliases resolve to the existing `Legend of Zelda` Studio instead of creating or searching for `The Legend of Zelda`.
- AxenAnim support now includes the `AxenAnim` group alias plus Countess/Paragon, Starfire/Raven/Teen Titans, Shani/The Witcher, and Cammy White/Chun-Li/Street Fighter mappings.
- The visible scene task enables strict missing-character creation from the first title segment when a franchise folder or trusted existing creator Group is present. Subtitle segments remain excluded, generic values are blocked, compact spellings prefer existing Tags, and successful object creation emits `OBJECT_CREATED` log lines.

## Next Steps In Stash

1. Reload plugins in Stash.
2. Confirm only one "Scene Auto-Tagger" appears, with plugin ID `scene-auto-tagger` and version `0.2.2`.
3. If the old plugin ID `plugin` also appears, remove the obsolete live `plugin.yml` and reload plugins again.
4. Do not expect detailed plugin settings in the UI; the manifest is settings-free on purpose.
5. To teach from a player page, edit and save a scene, then click **Teach Auto-Tagger**. From the main browser, select one scene, open the pencil editor, and click **Apply & Teach Auto-Tagger**.
6. Review every proposed rule. Save only intended mappings, then use **Preview matching repairs** for already-affected scenes.
7. Use **Learned Corrections** to inspect rules, disable one, or undo the latest teaching event.
8. Run the bulk task from the UI when you want a real apply pass over actionable scenes.
9. Open Tasks -> the specific job log for that run.
10. Look for `[scene-auto-tagger]` lines, `BULK DISCOVERY`, `CSV_ROW:` rows, `BULK PROGRESS`, and the final line:

```text
===== SCENE AUTO-TAGGER FINAL SUMMARY run=... =====
```

11. Look for `LEARN_PREVIEW`, `LEARN_APPLIED`, `LEARNED_RULES`, and `LEARN_REPAIR_*` lines when diagnosing teaching behavior.
12. Look for `RUNTIME_ALIAS_INDEX` near the top of each task log. It should report nonzero Studio/Group/Tag counts when GraphQL indexing is working.
13. Look for `EXISTING_CLOSE_MATCH`, `ALIAS_UPDATED`, `ALIAS_UPDATE_FAILED`, and `MISS_CANDIDATE` lines when diagnosing normal tagging.

If you click the plain Tasks UI button and do not pass `scene_ids`, the plugin should now log `BULK DISCOVERY ...`, select up to `sceneDiscoveryLimit` incomplete Rule34 scenes with apply-level candidate work or cleanup-only `Needs Review` repair, and process them in real apply mode using additive updates. The same run may add high-confidence aliases to matched Stash objects. Existing `Needs Review` rows are selected only if they can now be repaired with real metadata or have already-resolved apply-confidence metadata. If discovery finds no matching scenes, it logs `BULK NOTICE ... no scenes selected` and a final summary with `processed=0`.

For previews, invoke `runPluginTask` with explicit `args_map.scene_ids` or config overrides including `dryRun: true`.

## Logging And Progress

All reliable Stash v0.30.1 output goes through `console.log`.

The plugin also tries runtime helpers if Stash exposes them:

- `runtime.log(...)`
- `runtime.log.info(...)`
- `runtime.logger.info(...)`
- `runtime.Log(...)`
- `runtime.progress(...)`
- `runtime.progress.update(...)`
- `runtime.setProgress(...)`
- `runtime.task.setProgress(...)`

If those helpers are missing or shaped differently, the plugin keeps running and continues logging through `console.log`.

## Alias Maintenance

Prefer maintaining aliases in Stash first:

- Studio aliases on Studios.
- Group aliases on Groups.
- Character aliases on Tags.
- Character -> franchise links through Tag parents that match existing Studio names.

Edit `aliases.json` only for seed/fallback cases that are not yet represented in Stash metadata. Because Stash embedded JS may not read adjacent files, sync those fallback changes into the `EMBEDDED_ALIASES` block in `scene-auto-tagger.js` before production use.

## Verification

Local syntax check:

```bash
node --check scene-auto-tagger.js
node --check ui/scene-auto-tagger-learning.js
node verify_scene_auto_tagger_learning.mjs
```

This check does not write to Stash. Runtime behavior should be validated through Stash dry-run task logs.

## Rollback

Backups of previous plugin folders live next to the live plugin folder with names like:

```text
scene-auto-tagger.backup-YYYYMMDD-HHMMSS
```

Restore from the latest backup if the plugin fails to reload. For Stash data rollback, use CSV `current_*` values to build manual inverse `sceneUpdate` calls.
