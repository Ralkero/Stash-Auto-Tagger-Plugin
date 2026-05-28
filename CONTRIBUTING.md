# Contributing

Thanks for helping improve Scene Auto-Tagger.

## Before Changing Behavior

This plugin updates Stash metadata, so safety changes matter more than clever parsing.

Please preserve these invariants:

- Dry-run must not create or update anything.
- Existing groups and tags must never be removed by normal tagging.
- Existing Studio must not be overwritten unless explicitly configured.
- Review-confidence matches must not apply inferred metadata.
- The create hook should remain disabled unless separately reviewed.

## Local Checks

Run the syntax check before opening a pull request:

```bash
node --check scene-auto-tagger.js
```

When possible, validate behavior in Stash with a small dry-run or targeted test batch and include the relevant `CSV_ROW:` / summary lines in the pull request.

## Alias Contributions

Prefer improvements that let users maintain aliases in Stash metadata. Embedded fallback aliases are useful, but they should not become the only way to extend the plugin.
