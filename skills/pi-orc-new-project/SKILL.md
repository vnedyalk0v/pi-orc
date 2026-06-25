---
name: pi-orc-new-project
description: Guide pi-orc new-project bootstrap work. Use when planning or creating a repository foundation with pi-orc intake validation, dry-run planning, assisted local template writes, and verification gates.
---

# pi-orc New Project

Use this skill for `pi-orc new-project` bootstrap work.

## Workflow

1. Start from a selected issue or explicit intake file.
2. Validate the intake before any write:

   ```sh
   pi-orc new-project --dry-run --intake path/to/intake.json
   ```

3. Review the rendered plan for files, GitHub actions, git actions, and policy gates.
4. For assisted local template writes only, run:

   ```sh
   pi-orc new-project --intake path/to/intake.json
   ```

5. Verify generated files before committing.

## Guardrails

- Dry-run mode must not mutate files, git, or GitHub.
- Assisted mode may write local template files when policy allows it.
- GitHub repository, Project, issue, commit, and push actions stay gated until explicit user approval.
- Do not add prompts, themes, UI extensions, release automation, autonomous merge behavior, or generic sub-agent framework behavior.
- Commit only verified durable artifacts.

## Checks

Run the narrowest relevant checks for the change. For package changes, use:

```sh
npm run typecheck
npm run build
npm test
git diff --check
```
