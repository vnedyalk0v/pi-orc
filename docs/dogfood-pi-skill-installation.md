# Pi Skill Package Dogfood Report

## Summary

The packed `pi-orc` package was dogfooded through Pi Coding Agent after adding
the first explicit skill resource.

The package tarball installed successfully from a local extracted package, Pi
resource discovery reported exactly one skill, and `pi list --approve` reported
the project-local package path.

No product gaps were found during this dogfood pass.

A follow-up Issue #92 pass also verified the stricter user-like installed
package path, `./node_modules/pi-orc`, prompt skill formatting, and a real
read-only `pi -p` skill-use smoke.

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

## Issue #92 Installed Package Path Dogfood

Issue #92 verified the packed package through the installed npm package path a
user will exercise before release.

Issue tracking:

- Issue: https://github.com/vnedyalk0v/pi-orc/issues/92
- Assignee: `vnedyalk0v`
- Status label during execution: `status:in-progress`
- Project: `pi-orc`
- Project Status during execution: `In Progress`
- Project fields: Priority `P0`, Type `test`, Area `testing`, Source `manual`

Branch:

```text
test/issue-92-installed-pi-package-dogfood
```

Temporary sandbox:

```text
/tmp/pi-orc-installed-dogfood-92.Diu4sT
```

Sandbox layout:

- `project/`: clean project that installed the packed tarball and ran Pi from
  `./node_modules/.bin/pi`
- `agent/`: temporary `PI_CODING_AGENT_DIR` for package install/list checks

No sandbox directory, raw output file, extracted package, or tarball is
committed.

Pack command:

```sh
npm pack --json --pack-destination /tmp/pi-orc-installed-dogfood-92.Diu4sT
```

Result: pass. `prepack` rebuilt the package with `npm run build`, and the
tarball was `pi-orc-0.1.0.tgz` with 66 entries.

Clean project install:

```sh
cd /tmp/pi-orc-installed-dogfood-92.Diu4sT/project
npm init -y
npm install /tmp/pi-orc-installed-dogfood-92.Diu4sT/pi-orc-0.1.0.tgz
node --input-type=module -e 'const pkg = await import("./node_modules/pi-orc/package.json", { with: { type: "json" } }); console.log(`${pkg.default.name}@${pkg.default.version}`);'
```

Result:

```text
pi-orc@0.1.0
```

Installed package registration:

```sh
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 \
  ./node_modules/.bin/pi \
  install -l ./node_modules/pi-orc --approve
```

Output:

```text
Installing ./node_modules/pi-orc...
Installed ./node_modules/pi-orc
```

Approved package list:

```sh
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 \
  ./node_modules/.bin/pi \
  list --approve
```

Output:

```text
Project packages:
  ../node_modules/pi-orc
    /private/tmp/pi-orc-installed-dogfood-92.Diu4sT/project/node_modules/pi-orc
```

Package resource resolution from the installed path:

```json
{
  "extensions": 0,
  "skills": [
    "node_modules/pi-orc/skills/pi-orc-new-project/SKILL.md"
  ],
  "prompts": 0,
  "themes": 0
}
```

Prompt formatting included the installed skill:

```text
<name>pi-orc-new-project</name>
```

Read-only real Pi skill-use smoke:

```sh
./node_modules/.bin/pi \
  --provider openai-codex \
  --model gpt-5.4-mini \
  --approve \
  --no-extensions \
  --no-session \
  --no-builtin-tools \
  --tools read \
  -p '/skill:pi-orc-new-project Reply with exactly two lines: skill: pi-orc-new-project; command: the recommended dry-run command from the skill.'
```

Output:

```text
skill: pi-orc-new-project
command: pi-orc new-project --dry-run --intake path/to/intake.json
```

`--no-extensions` was used only to isolate the smoke from unrelated user-global
extension failures. It did not disable package skill loading.

Problems found: none.

Scope check:

- Used a packed local tarball, not `npm link`.
- Installed the tarball into a clean temporary project.
- Registered Pi package path `./node_modules/pi-orc`.
- Verified `pi list --approve` reports the installed package path.
- Verified package resolution reports exactly one skill from
  `./node_modules/pi-orc`.
- Verified prompt formatting includes `pi-orc-new-project`.
- Verified a real `pi -p` invocation can use `pi-orc-new-project`.
- Did not publish to npm.
- Did not create a GitHub release.
- Did not create a git tag.
- Did not modify repository settings.
