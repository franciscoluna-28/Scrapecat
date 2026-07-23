# Commit Conventions

## Workflow

1. **Draft first** — before committing, show the user a summary of what will be committed (files changed, nature of changes). Wait for approval.
2. **Stage thoughtfully** — group related changes into atomic commits, scoped by feature area. Don't mix concerns (e.g., a feat in reports with unrelated refactors in auth).
3. **Review git safety rules** — never force push, never amend without user approval, never skip hooks.

## Message Format

Use [conventional commits](https://www.conventionalcommits.org/) with lowercase types and an optional scope:

```
type(scope): short description (imperative, lowercase, no period)

- Bullet point details when needed
- Each atomic commit should group related changes within a single scope
```

Always split changes by feature area — use a scope to indicate which part of the codebase the commit touches.

## Types

| Type | When to use |
|---|---|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring with no behavior change |
| `chore:` | Tooling, config, dependencies, Docker setup |
| `docs:` | Documentation only |

## Scopes

Common scopes used in this repo:

| Scope | Area |
|---|---|
| `reports` | Report generation, synthesis, markdown output |
| `repos` | Repository sync, commit/branch fetching |
| `auth` | Authentication, tokens, GitHub OAuth |
| `api` | Route structure, OpenAPI spec, versioning |
| `ui` | Frontend components, pages, layout |
| `docker` | Dockerfiles, compose, container config |
| `db` | Database schema, migrations, Drizzle |
| `config` | Environment, tooling, build setup |

If a change spans multiple scopes, pick the dominant one and use bullet points to describe the rest.

## Examples from this repo

```
feat(docker): add separate dev dockerfiles for backend and frontend

- create backend/Dockerfile.dev and frontend/Dockerfile.dev for focused dev builds
- simplify docker-compose.yml to dev-only with container names fabric-backend and fabric-ui
- merge codegraph instructions from CLAUDE.md into AGENTS.md
- update README.md to reflect current architecture and docker setup
```

```
refactor(api): add v1 versioning and restful resource nesting

- Prefix all routes with /api/v1/
- Nest commits and branches under /api/v1/repositories/{owner}/{repo}/
- Move owner/repo from query params to path params
```

```
chore(docker): add compose dev services and frontend env example

- Add backend-dev and frontend-dev services to docker compose
- Add frontend/.env.example with NEXT_PUBLIC_API_URL documentation
```

```
feat(ui): add repository onboarding wizard

- multi-step form with organization/repo selection
- loading states and error handling for API calls
- success page with next-step CTA
```

## Git Safety Rules

- Never update git config
- Never force push (especially to main/master)
- Never skip hooks (`--no-verify`, `--no-gpg-sign`)
- Never commit if user didn't ask for it
- Only use `--amend` when: user explicitly requests it AND HEAD commit was created in this conversation AND commit hasn't been pushed
- If a commit fails (rejected by hook), fix and create a NEW commit — never amend a failed one
