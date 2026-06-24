# License Decision

## Current State

No license has been selected for `pi-orc`.

- `README.md` says the license is `TBD`.
- `package.json` does not declare a `license` field.
- No `LICENSE` or `LICENSE.md` file exists.
- `docs/package-installability.md` verifies package installability, but the publish-readiness state still depends on a project-owner license decision.

## Decision Required

The project owner must choose the repository license before npm publish or GitHub release.

This document is not legal advice. License choice is a project-owner and legal decision.

## Common Options

### MIT

Permissive license. Common for small open source JavaScript and TypeScript packages. Allows reuse with minimal obligations, usually requiring license and copyright notice preservation.

### Apache-2.0

Permissive license with explicit patent grant language. Common when patent protection terms matter. Usually requires preserving notices and license text.

### BSD-3-Clause

Permissive license with a non-endorsement clause. Allows broad reuse while restricting use of contributor names for promotion without permission.

### GPL-3.0-only or GPL-3.0-or-later

Copyleft license. Derivative works distributed to others generally need to be licensed under compatible GPL terms.

### AGPL-3.0-only or AGPL-3.0-or-later

Network copyleft license. Similar to GPL, with additional source-sharing expectations when users interact with the software over a network.

### No Open Source License Yet

Keeps rights reserved by default. Public visibility does not grant broad reuse rights. This avoids choosing prematurely, but blocks clear open source distribution and publish-readiness.

## Publish Readiness Impact

`pi-orc` is not publish-ready until the license decision is recorded.

Before publish or release:

- choose a license;
- add the matching `LICENSE` file;
- update the README license section;
- add `package.json` `license` metadata when appropriate;
- re-run package verification.

## Recommended Next Action

The project owner should choose one license option, then update the repository metadata and publish-readiness docs in one scoped change.

If the goal is broad reuse with minimal restrictions, evaluate MIT, Apache-2.0, and BSD-3-Clause first. If the goal is requiring distributed derivatives to remain open, evaluate GPL or AGPL terms with legal review.
