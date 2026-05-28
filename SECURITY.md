# Security Policy

## Supported Versions

Only the latest release is actively maintained.

## Reporting Issues

Please open a GitHub issue for safety bugs, data-loss risks, or Stash compatibility problems.

For reports that include logs:

- Remove absolute local paths if they reveal private directories.
- Remove scene titles or filenames you do not want to share.
- Include the plugin version, Stash version, and whether the task was a dry-run.

## Safety Expectations

This plugin can create metadata objects and update scenes during real apply-mode runs. It is designed to be conservative, but users should keep regular Stash database backups and test with small batches before broad runs.
