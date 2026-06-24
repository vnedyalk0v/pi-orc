# Main Branch Protection Plan

Issue: #59
Date: 2026-06-24

## Summary

`main` is currently unprotected. No branch protection, repository ruleset, or
active branch rule applies to `main`.

Recommended next step: after explicit owner confirmation, add one active
repository ruleset targeting `~DEFAULT_BRANCH`. Keep bypass actors empty, require
pull requests, require the current CI check, require review conversation
resolution, block force pushes, and block branch deletion.

No repository setting was changed while preparing this plan.

## Current Protection State

Verified with:

```sh
gh repo view vnedyalk0v/pi-orc --json nameWithOwner,defaultBranchRef,visibility,url,deleteBranchOnMerge,mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed,viewerPermission,viewerCanAdminister,hasIssuesEnabled,hasProjectsEnabled
gh api repos/vnedyalk0v/pi-orc/branches/main/protection
gh api repos/vnedyalk0v/pi-orc/rulesets
gh api repos/vnedyalk0v/pi-orc/rules/branches/main
gh api repos/vnedyalk0v/pi-orc/branches/main --jq '{name, protected, protection_url, commit_sha: .commit.sha}'
```

Findings:

- Repository: `vnedyalk0v/pi-orc`
- Visibility: public
- Default branch: `main`
- Current `main` commit inspected: `3ad0b9c856cc2bd25eb295a06065288294cc3b75`
- `branches/main/protection`: `404 Branch not protected`
- `branches/main protected`: `false`
- Repository rulesets: `[]`
- Active rules for `main`: `[]`
- Merge methods: squash allowed, merge commit disabled, rebase disabled
- Delete branch on merge: enabled
- Auto-merge: disabled
- Actions default workflow permission: read

## Required Check Name

Verified with:

```sh
gh pr checks 58 --repo vnedyalk0v/pi-orc --json name,workflow,state,completedAt,link
gh pr view 58 --repo vnedyalk0v/pi-orc --json number,title,headRefOid,statusCheckRollup,reviewDecision,mergeStateStatus
gh run view 28101751159 --repo vnedyalk0v/pi-orc --json name,displayTitle,event,headBranch,headSha,conclusion,status,jobs,url
```

Latest successful pull request CI evidence:

- PR: #58
- Workflow: `CI`
- Job/check name: `verify`
- UI label: `CI / verify`
- API required status check context: `verify`
- PR run: `28101751159`
- Result: success

Use `verify` in `required_status_checks[].context` API payloads. In the GitHub
web UI, select the check displayed as `CI / verify`.

## Recommended Protection Policy

Use a repository ruleset rather than classic branch protection because it makes
bypass behavior explicit through `bypass_actors`.

Recommended settings:

- Target: default branch only, `~DEFAULT_BRANCH`
- Enforcement: active
- Bypass actors: none
- Pull request required: yes
- Required approving reviews: `0`
- Required review thread resolution: yes
- Status checks required: yes
- Required status check context: `verify`
- Require branch up to date before merge: yes
- Force pushes: blocked through `non_fast_forward`
- Deletions: blocked through `deletion`
- Admin/bypass behavior: no configured bypass actors

Do not enable merge queue, code owner review, signed commits, deployment gates,
or linear history in this issue. Those are separate policy decisions.

## Apply Command

Run this only after explicit owner confirmation in the current task:

```sh
gh api --method POST repos/vnedyalk0v/pi-orc/rulesets --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["squash"],
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_approving_review_count": 0,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          {
            "context": "verify"
          }
        ]
      }
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "deletion"
    }
  ]
}
JSON
```

## Post-Apply Verification

After applying, verify:

```sh
gh api repos/vnedyalk0v/pi-orc/rulesets
gh api repos/vnedyalk0v/pi-orc/rules/branches/main
gh api repos/vnedyalk0v/pi-orc/branches/main --jq '{name, protected}'
```

Expected results:

- Ruleset `protect-main` exists.
- `main` has active `pull_request`, `required_status_checks`,
  `non_fast_forward`, and `deletion` rules.
- Required status check context is `verify`.
- Pull request rule has `required_review_thread_resolution: true`.
- `branches/main protected` becomes `true`.

## Manual UI Steps

Use only after explicit owner confirmation:

1. Open `https://github.com/vnedyalk0v/pi-orc/settings/rules`.
2. Create a new branch ruleset named `protect-main`.
3. Set target to default branch.
4. Set enforcement to active.
5. Leave bypass list empty.
6. Enable require pull request before merge.
7. Set required approvals to `0`.
8. Enable required conversation resolution.
9. Enable required status checks and require branches to be up to date.
10. Select the check displayed as `CI / verify`.
11. Enable block force pushes.
12. Enable block deletions.
13. Save, then run the post-apply verification commands above.

## Classic Branch Protection Fallback

Use this only if repository rulesets cannot be used. It is less explicit about
bypass behavior than a ruleset.

```sh
gh api --method PUT repos/vnedyalk0v/pi-orc/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [],
    "checks": [
      {
        "context": "verify"
      }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

## Risks and Rollback

Risks:

- If `verify` is misconfigured or renamed, PRs can stay blocked waiting for an
  expected check.
- If `.github/workflows/ci.yml` stops running on pull requests to `main`, PRs
  can stay blocked.
- Empty bypass actors means normal merges must satisfy the ruleset.
- Admins can still edit or delete repository rulesets through settings/API.

Rollback:

```sh
gh api repos/vnedyalk0v/pi-orc/rulesets
gh api --method DELETE repos/vnedyalk0v/pi-orc/rulesets/<ruleset-id>
gh api repos/vnedyalk0v/pi-orc/rules/branches/main
```

## Safety Decision

Applying now is technically safe after owner confirmation because recent PR CI
passed and the required check exists.

User confirmation is still required because this issue changes repository
settings, affects merge policy, and may block direct pushes to `main`.

## Scope Confirmation

- No branch protection was applied.
- No repository ruleset was created.
- No repository setting was changed.
- No source code was changed.
- No PR was created.
- No merge was performed.
- No force push was performed.
- No admin bypass was used.

## References

- GitHub REST branch protection API:
  `https://docs.github.com/en/rest/branches/branch-protection`
- GitHub REST repository rulesets API:
  `https://docs.github.com/en/rest/repos/rules`
- GitHub status checks documentation:
  `https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks`
