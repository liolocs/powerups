<!--
Your PR title feeds the changelog. Please use the conventional-commits format:

  type(scope): summary

Types: feat, fix, chore, refactor, docs, test, perf
Scope (optional): a command or area, e.g. `pack`, `project`, `scaffold`.

Examples:
  feat(pack): support moving packs between stores
  fix(find): match powerups with trailing variables
  chore: bump dependencies
-->

## Summary

<!-- What & why, in a sentence or two. -->

## Related issue

<!-- `Closes #NNN`, `Refs #NNN`, or "none". -->

## Type

<!-- Check the one that matches your PR title prefix. -->

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] chore — tooling, deps, config
- [ ] refactor — no behavior change
- [ ] docs — documentation
- [ ] test — tests only
- [ ] perf — performance

## Changes

<!-- Bulleted list of what changed. -->

-

## Breaking changes

<!-- "none", or describe the change + how to migrate. -->

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] Added or updated tests for the change
- [ ] CHANGELOG not hand-edited (releases are automated via `pnpm release`)