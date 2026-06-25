# Pi Skill Package Dogfood Report

## Summary

The packed `pi-orc` package was dogfooded through Pi Coding Agent after adding
the first explicit skill resource.

The package tarball installed successfully from a local extracted package, Pi
resource discovery reported exactly one skill, and `pi list --approve` reported
the project-local package path.

No product gaps were found during this dogfood pass.

## Issue Tracking

- Issue: https://github.com/vnedyalk0v/pi-orc/issues/87
- Assignee: `vnedyalk0v`
- Status label during execution: `status:in-progress`
- Project: `pi-orc`
- Project Status during execution: `In Progress`
- Project fields: Priority `P0`, Type `test`, Area `testing`, Source
  `planning`

## Branch

`test/pi-skill-dogfood-87`

## Sandbox

Temporary sandbox:

```text
/tmp/pi-orc-skill-dogfood-clean.p6qFMs
```

Sandbox layout:

- `pkg/`: extracted packed package
- `project/`: clean project directory that installed the packed tarball and
  ran Pi commands through its own `./node_modules/.bin/pi`
- `agent/`: temporary `PI_CODING_AGENT_DIR`

No sandbox directory, raw output file, extracted package, or tarball is
committed.

## Pack Verification

Command:

```sh
npm pack --json --pack-destination /tmp/pi-orc-skill-dogfood-clean.p6qFMs
```

Result: pass.

`prepack` rebuilt the package with `npm run build`.

Pack output included:

- package name: `pi-orc`
- package version: `0.1.0`
- filename: `pi-orc-0.1.0.tgz`
- entry count: `66`
- skill resource: `skills/pi-orc-new-project/SKILL.md`
- dogfood report: `docs/dogfood-pi-skill-installation.md`

The tarball path was:

```text
/tmp/pi-orc-skill-dogfood-clean.p6qFMs/pi-orc-0.1.0.tgz
```

## Resource Discovery

Command:

```sh
node --input-type=module - "$tmp/pkg/package" "$tmp/project" "$tmp/agent"
```

Script:

```js
import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";

const [packageRoot, cwd, agentDir] = process.argv.slice(2);
const settingsManager = SettingsManager.inMemory();
const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
const resolved = await packageManager.resolveExtensionSources([packageRoot], { temporary: true });
console.log(JSON.stringify({
  extensions: resolved.extensions.length,
  skills: resolved.skills.map((skill) => skill.path.replace(packageRoot, "package")),
  prompts: resolved.prompts.length,
  themes: resolved.themes.length
}, null, 2));
```

Result:

```json
{
  "extensions": 0,
  "skills": [
    "package/skills/pi-orc-new-project/SKILL.md"
  ],
  "prompts": 0,
  "themes": 0
}
```

This confirms package discovery uses the explicit `package.json` `pi.skills`
entry and reports no unexpected extensions, prompts, or themes.

## Pi Install Verification

The clean sandbox project installed the packed tarball first:

```sh
cd /tmp/pi-orc-skill-dogfood-clean.p6qFMs/project
npm init -y
npm install /tmp/pi-orc-skill-dogfood-clean.p6qFMs/pi-orc-0.1.0.tgz
```

The installed package name was `pi-orc`.

Pi was then run from the clean project's installed dependency:

```text
/private/tmp/pi-orc-skill-dogfood-clean.p6qFMs/project/node_modules/@earendil-works/pi-coding-agent/dist/cli.js
```

Command:

```sh
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 \
  ./node_modules/.bin/pi \
  install -l ../pkg/package
```

Result: pass.

Output:

```text
Installing ../pkg/package...
Installed ../pkg/package
```

## Pi Approved List Verification

Command:

```sh
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 \
  ./node_modules/.bin/pi \
  list --approve
```

Result: pass.

Output:

```text
Project packages:
  ../../pkg/package
    /private/tmp/pi-orc-skill-dogfood-clean.p6qFMs/pkg/package
```

Pi's `list` command reports local package paths. The listed extracted package
resolves from the clean sandbox project to the extracted package with
`package.json` `name: "pi-orc"` and:

```json
{
  "pi": {
    "skills": [
      "./skills/pi-orc-new-project/SKILL.md"
    ]
  }
}
```

Without `--approve`, the same project reported:

```text
No packages installed.
```

That matches Pi's project trust behavior for project-local settings.

## Problems Found

No gaps were found during this dogfood pass, so no follow-up issue was created.

## Files Changed

- `docs/dogfood-pi-skill-installation.md`

## Verification

Commands run:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm pack --json --pack-destination /tmp/pi-orc-skill-dogfood-clean.p6qFMs
node --input-type=module - "$tmp/pkg/package" "$tmp/project" "$tmp/agent"
cd "$tmp/project"
npm init -y
npm install "$tmp/pi-orc-0.1.0.tgz"
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi install -l ../pkg/package
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi list --approve
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi list
```

Final branch verification:

```sh
git diff --check
git diff --stat
```

## Scope Check

- Used a packed local tarball, not `npm link`.
- Used temporary `PI_CODING_AGENT_DIR`.
- Verified resource discovery against the extracted packed package.
- Verified Pi local install and approval/list behavior.
- Did not publish to npm.
- Did not create a GitHub release.
- Did not create a git tag.
- Did not modify repository settings.
- Did not commit raw temporary output, tarball, extracted package, or sandbox
  directory.

## Final State

Pi skill package dogfood passed. Branch remains scoped to Issue #87 until this
report is merged.
