# pi-orc v0.1.0

Issue: #74
Release target: npm publish plus GitHub release

## Summary

`pi-orc` v0.1.0 is the foundation release for an opinionated Pi package that
models verified AI-assisted GitHub workflows.

## Included

- TypeScript package entrypoint with typed runtime, policy, GitHub adapter, and
  repo-bootstrap exports.
- `pi-orc` CLI binary.
- `pi-orc new-project --dry-run` for rendering a bootstrap plan without GitHub,
  git, or filesystem mutations.
- New-project intake validation schemas.
- Target repository templates for docs, issue templates, PR template, workflow
  config, and `AGENTS.md`.
- Release-readiness, installability, and dogfood verification documents.

## Not Included

- Execution mode for `pi-orc new-project`.
- Release automation.
- Autonomous merge behavior.
- Pull request review monitoring or review-thread resolution.
- Pi resources in the package manifest.

## Verification

Release must be created only after these commands pass from clean `main`:

```sh
npm ci
npm run typecheck
npm run build
npm test
rm -rf dist
npm pack --dry-run --json
git diff --check
```

Before publishing, confirm no existing release artifact:

```sh
gh release list
git ls-remote --tags origin
npm view pi-orc version --json
```

Expected pre-publish npm result: `E404 Not Found`.

## Rollback Notes

If the git tag or GitHub release is created incorrectly, delete the release and
remote tag before retrying.

If npm publish succeeds with a bad package, do not unpublish without owner
approval. Prefer a corrective patch release.
