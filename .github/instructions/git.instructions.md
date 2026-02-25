---
applyTo: "**/.git*,**/.github/**,**/CHANGELOG*,**/CHANGES*"
---
## COMMITS

- [P0-MUST] Use Conventional Commits format: `<type>(<scope>): <description>`.
- [P0-MUST] Subject line: imperative mood, lowercase, max 72 characters, no period.
- [P1-SHOULD] Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- [P1-SHOULD] Body: explain WHAT and WHY, not HOW. Wrap at 80 characters.
- [P1-SHOULD] Breaking changes: add `BREAKING CHANGE:` footer or `!` after type.

## BRANCHES

- [P1-SHOULD] Pattern: `<type>/<short-description>` (kebab-case, no spaces, under 50 chars).
- [P1-SHOULD] Types: `feature/`, `fix/`, `chore/`, `release/`, `hotfix/`.
- [P2-MAY] Include ticket number: `fix/PROJ-123-login-redirect`.

## PULL_REQUESTS

- [P1-SHOULD] Title follows conventional commit format.
- [P1-SHOULD] Body includes: summary (1-3 sentences), list of changes, test plan, breaking changes.
- [P1-SHOULD] Keep PRs focused. One logical change per PR.
- [P2-MAY] Add screenshots for UI changes.

## MERGE_STRATEGY

- [P1-SHOULD] Squash merge feature branches to main.
- [P1-SHOULD] Delete branches after merge.
- [P0-MUST] Never force push to main, develop, or release branches.
