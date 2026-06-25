# Package Installability Verification

Issue: #55
Date: 2026-06-24
Updated: 2026-06-25 for Issue #88
Updated: 2026-06-25 for Issue #93 installed package path docs

## Summary

`pi-orc` was verified as packable, installable from a local npm tarball,
importable, runnable through its `pi-orc` binary, and discoverable as a Pi
Coding Agent package with one explicit skill resource.

The current `pi` manifest intentionally exposes only
`skills/pi-orc-new-project/SKILL.md`. The package does not expose Pi
extensions, prompts, or themes.

## package.json Review

- `name`: `pi-orc`
- `version`: `0.1.0`
- `type`: `module`
- `bin`: `pi-orc` -> `./dist/cli/pi-orc.js`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`: root import and types point at `dist/index.*`
- `files`: `dist/`, `skills/pi-orc-new-project/`, `templates/`,
  `README.md`, `docs/`
- `pi.skills`: `./skills/pi-orc-new-project/SKILL.md`
- `scripts`: `build`, `prepack`, `test`, `typecheck`

The metadata matches the current package surface: one library export, one CLI
binary, one Pi skill resource, docs, and target repository templates.

## npm Pack Verification

Commands:

```sh
npm ci
npm run typecheck
npm run build
npm test
rm -rf dist
npm pack --dry-run --json
```

Result: pass.

`npm pack --dry-run --json` rebuilt through `prepack` and reported 66 entries
after adding the Pi skill and dogfood report.

Confirmed included:

- `package/dist/index.js`
- `package/dist/index.d.ts`
- `package/dist/cli/pi-orc.js`
- `package/skills/pi-orc-new-project/SKILL.md`
- `package/templates/`
- `package/README.md`
- `package/docs/`
- `package/package.json`

Confirmed excluded:

- `package/src/`
- `package/tests/`
- `package/.ai-workflow/runs`
- `package/.ai-workflow/cache`
- `package/.ai-workflow/tmp`

## CLI Verification

Command:

```sh
node dist/cli/pi-orc.js --help
```

Result: pass. The built CLI prints usage for:

```text
pi-orc new-project --dry-run [--intake path/to/intake.json]
```

## Local Package Install Verification

Commands:

```sh
npm pack --json
tmp=$(mktemp -d)
mkdir -p "$tmp/pkg" "$tmp/project" "$tmp/agent"
tar -xzf pi-orc-0.1.0.tgz -C "$tmp/pkg"
cd "$tmp/project"
npm init -y
npm install /Users/vnedyalk0v/Projects/Personal/pi-orc/pi-orc-0.1.0.tgz
./node_modules/.bin/pi-orc --help
node --input-type=module -e "import('pi-orc').then(m => console.log(JSON.stringify(m.packageInfo)))"
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi install -l ../pkg/package
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi list --approve
```

Result: pass.

Findings:

- npm installed the local tarball into a clean temporary project.
- `./node_modules/.bin/pi-orc --help` worked from the installed package.
- `import('pi-orc')` returned `packageInfo`.
- `pi install -l <extracted-package>` added the local package to project
  settings.
- `pi list --approve` reported the project package path.
- `pi list` without `--approve` reported no packages, which matches Pi's project trust behavior.

Issue #92 added the stricter user-like installed package path check:

```sh
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi install -l ./node_modules/pi-orc --approve
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi list --approve
```

Expected list shape:

```text
Project packages:
  ../node_modules/pi-orc
    /private/tmp/.../project/node_modules/pi-orc
```

That follow-up also verified resource discovery from
`./node_modules/pi-orc`, prompt formatting for `pi-orc-new-project`, and a
real read-only `pi -p` smoke using `/skill:pi-orc-new-project` under the same
temporary `PI_CODING_AGENT_DIR`. Use `--no-extensions` only to isolate
unrelated user-global extension failures; it is not required for the package
skill itself.

## Pi Resource Discovery

Verified against Pi 0.79.10 documentation and installed package-manager code:

- Pi packages may declare resources under `package.json` `pi`.
- Without a `pi` manifest, Pi auto-discovers conventional directories: `extensions/`, `skills/`, `prompts/`, and `themes/`.
- With an explicit `pi` manifest, Pi uses the manifest.

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

## Decision on pi Manifest

Keep the current `pi` manifest explicit:

```json
{
  "skills": [
    "./skills/pi-orc-new-project/SKILL.md"
  ]
}
```

Reason: v0.1 intentionally publishes one Pi skill for new-project bootstrap
work. Explicit metadata prevents accidental conventional-directory discovery if
package contents later include directories named `prompts`, `themes`, or
`extensions`, or extra skill directories, for non-resource reasons.

Add more explicit `pi` entries only when the package intentionally ships more
Pi resources.

## Scope Confirmation

- No npm publish was performed.
- No GitHub release was created.
- Package metadata now exposes exactly one Pi skill resource.
- No prompts, themes, UI extensions, release automation, autonomous merge
  behavior, or generic sub-agent framework behavior was added.
- No repository settings were changed.
