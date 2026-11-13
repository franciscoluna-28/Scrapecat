# Contributing

Thanks for helping improve Scrapecat.

## Setup

```bash
pnpm install
cp backend/.env.example backend/.env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

See [`docs/environment.md`](docs/environment.md) for the full environment reference.

## Before opening a pull request

```bash
pnpm check
```

This runs typecheck, lint, and tests. Add tests for changed behavior.

## Style

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Keep changes focused.
- Never commit secrets or `.env` files.
- Do not edit `frontend/src/shared/api/types.ts` by hand; run `pnpm codegen`.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
