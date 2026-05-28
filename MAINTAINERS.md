# Maintainer Notes

## Release Checklist

1. Update `PLUGIN_VERSION` in `scene-auto-tagger.js`.
2. Update `version` in `plugin.yml`.
3. Update `CHANGELOG.md`.
4. Run:

   ```bash
   node --check scene-auto-tagger.js
   ```

5. Reload plugins in Stash and confirm the task appears.
6. Run a small dry-run or targeted task before broad apply-mode testing.
7. Tag the release in git after validation.

## Alias Maintenance

Prefer maintaining aliases in Stash first:

- Studio aliases on Studios.
- Group aliases on Groups.
- Character aliases on Tags.
- Character-to-franchise links through Tag parents that match existing Studio names.

Use `aliases.json` and `EMBEDDED_ALIASES` only for seed/fallback coverage that is not practical to express in Stash metadata.

## Runtime Safety Invariants

Keep these invariants intact:

- `dryRun` defaults to `true` in `DEFAULT_CONFIG`.
- Dry-run must not call create/update mutations.
- Review-confidence scenes must not apply inferred Studio/Group/Character metadata.
- Existing groups and tags must be preserved additively.
- Existing Studio must be preserved unless `allowOverwriteExistingMetadata` is explicitly enabled.
- The create hook must remain unregistered unless it has gone through a separate safety review.
- Compare-before-write must happen immediately before `sceneUpdate`.

## Public Documentation

Avoid adding machine-specific paths, local logs, personal library details, or task output to public docs. Use generic examples and point users to their own Stash task logs.
