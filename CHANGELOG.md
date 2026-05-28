# Changelog

## 0.1.16

- Added runtime alias indexing from existing Stash Studios, Groups, Tags, aliases, and tag parents.
- Added character-to-Studio inference from parent tags when the parent matches an existing Studio or known Studio alias.
- Added sampled `MISS_CANDIDATE` reporting for scenes discovery cannot confidently tag.
- Kept the safety-first defaults: dry-run by default in JS, no hook registration, additive metadata updates, and compare-before-write.

## 0.1.15

- Expanded embedded fallback aliases for additional known creator/franchise/character filename patterns.

## 0.1.14

- Normalized common franchise aliases to existing Studio names.

## 0.1.13

- Improved cross-franchise behavior: keep all detected character tags and infer Studio from the first character mentioned when franchises conflict.

## 0.1.12

- Improved UI task behavior for bounded apply-mode discovery.
- Added safer `Needs Review` cleanup after successful apply-confidence repairs.

## 0.1.0 - 0.1.11

- Initial safety hardening.
- Embedded alias fallback.
- Better Stash embedded JS argument handling.
- Stronger dry-run and mutation guards.
- CSV-style audit logging.
