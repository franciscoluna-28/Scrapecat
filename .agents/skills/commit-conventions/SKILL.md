# Commit Conventions

## Workflow

1. **Draft first** — before committing, show the user a summary of what will be committed (files changed, nature of changes). Wait for approval.
2. **Stage thoughtfully** — group related changes into atomic commits. Don't mix concerns (e.g., a feat with unrelated refactors).
3. **Review git safety rules** — never force push, never amend without user approval, never skip hooks.

## Message Format

Use [conventional commits](https://www.conventionalcommits.org/) with lowercase types:

```
type: short description (imperative, lowercase, no period)

- Bullet point details when needed
- Each atomic commit should group related changes
```

## Types

| Type | When to use |
|---|---|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring with no behavior change |
| `chore:` | Tooling, config, dependencies, Docker setup |
| `docs:` | Documentation only |

## Examples from this repo

```
feat: add separate dev dockerfiles for backend and frontend

- create backend/Dockerfile.dev and frontend/Dockerfile.dev for focused dev builds
- simplify docker-compose.yml to dev-only with container names fabric-backend and fabric-ui
- merge codegraph instructions from CLAUDE.md into AGENTS.md
- update README.md to reflect current architecture and docker setup
```

```
refactor: add api v1 versioning and restful resource nesting

- Prefix all routes with /api/v1/
- Nest commits and branches under /api/v1/repositories/{owner}/{repo}/
- Move owner/repo from query params to path params
```

```
chore: add docker compose dev services and frontend env example

- Add backend-dev and frontend-dev services to docker compose
- Add frontend/.env.example with NEXT_PUBLIC_API_URL documentation
```

## Git Safety Rules

- Never update git config
- Never force push (especially to main/master)
- Never skip hooks (`--no-verify`, `--no-gpg-sign`)
- Never commit if user didn't ask for it
- Only use `--amend` when: user explicitly requests it AND HEAD commit was created in this conversation AND commit hasn't been pushed
- If a commit fails (rejected by hook), fix and create a NEW commit — never amend a failed one
