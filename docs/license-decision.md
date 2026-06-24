# License Decision

## Current State

`pi-orc` is licensed under Apache-2.0.

- `README.md` links to `LICENSE`.
- `package.json` declares `"license": "Apache-2.0"`.
- `LICENSE` contains the Apache License, Version 2.0 text.
- `docs/package-installability.md` verifies package installability.

## Decision

The project owner selected Apache-2.0 on 2026-06-24.

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

The license decision is recorded.

Before publish or release:

- re-run package verification.

## Recommended Next Action

Keep the license metadata, README, and release checklist aligned before publish or release.
