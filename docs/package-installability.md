# Package Installability Verification

Issue: #55
Date: 2026-06-24

## Summary

`pi-orc` was verified as packable, installable from a local npm tarball, importable, and runnable through its `pi-orc` binary.

No package metadata change is needed for v0.1 readiness. The current `pi` manifest is intentionally empty because the package currently exposes no Pi extensions, skills, prompts, or themes.

## package.json Review

- `name`: `pi-orc`
- `version`: `0.1.0`
- `type`: `module`
- `bin`: `pi-orc` -> `./dist/cli/pi-orc.js`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`: root import and types point at `dist/index.*`
- `files`: `dist/`, `templates/`, `README.md`, `docs/`
- `pi`: `{}`
- `scripts`: `build`, `prepack`, `test`, `typecheck`

The metadata matches the current package surface: one library export, one CLI binary, docs, and target repository templates.

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

`npm pack --dry-run --json` rebuilt through `prepack` and reported 54 entries after adding this report.

Confirmed included:

- `package/dist/index.js`
- `package/dist/index.d.ts`
- `package/dist/cli/pi-orc.js`
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
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 /Users/vnedyalk0v/Projects/Personal/pi-orc/node_modules/.bin/pi install -l "$tmp/pkg/package"
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 /Users/vnedyalk0v/Projects/Personal/pi-orc/node_modules/.bin/pi list --approve
```

Result: pass.

Findings:

- npm installed the local tarball into a clean temporary project.
- `./node_modules/.bin/pi-orc --help` worked from the installed package.
- `import('pi-orc')` returned `packageInfo`.
- `pi install -l <extracted-package>` added the local package to project settings.
- `pi list --approve` reported the project package path.
- `pi list` without `--approve` reported no packages, which matches Pi's project trust behavior.

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
console.log(Object.fromEntries(Object.entries(resolved).map(([key, value]) => [key, value.length])));
```

Result:

```json
{
  "extensions": 0,
  "skills": 0,
  "prompts": 0,
  "themes": 0
}
```

## Decision on pi Manifest

Keep the current `pi` manifest as:

```json
{}
```

Reason: v0.1 currently publishes workflow library code, a dry-run CLI, docs, and target repository templates, but no Pi resources. An explicit empty manifest prevents accidental conventional-directory discovery if package contents later include directories named `skills`, `prompts`, `themes`, or `extensions` for non-resource reasons.

Add explicit `pi` entries only when the package intentionally ships Pi resources.

## Scope Confirmation

- No npm publish was performed.
- No GitHub release was created.
- No package metadata was changed.
- No new workflow feature was implemented.
- No repository settings were changed.
