# Retrieval Evaluation

The eval harness runs a small golden set of queries through the real retriever
and reports whether the right commits reach the generator's context. Labels are
deterministic, so the harness is fast, free, and reproducible.

## Metrics

Computed over the top `k` (default 5) retrieved commit SHAs against each case's
judged `relevantShas`:

- **Context recall**: fraction of judged commits that were retrieved.
- **Context precision**: rank-aware. Each relevant hit contributes the precision
  at its rank, averaged over the relevant hits. One relevant commit at rank 1
  scores `1.0`.
- **MRR**: reciprocal rank of the first relevant commit. Debugging aid only.
- **Negative accuracy**: fraction of `negative` cases that return no results.

Metrics depend on `k`. Only compare runs at the same `k`; the MVP budget is 5,
and `--top-k` can go up to the hard cap for diagnostics.

Labels are not exhaustive, so recall is measured against the judged set.

Each report row also lists `missing` SHAs: judged commits that were not in the
returned context.

## Dataset

Datasets live in `backend/eval/datasets/*.json`:

```json
{
  "version": 1,
  "name": "scrapecat-dev",
  "project": {
    "gitProvider": "github",
    "providerOwner": "franciscoluna-28",
    "repositoryName": "scrapecat",
    "branch": "dev"
  },
  "embeddingSpace": { "provider": "openrouter", "model": "openai/text-embedding-3-small" },
  "cases": [
    {
      "id": "gitlab-support",
      "query": "When did we add support for GitLab repositories?",
      "category": "semantic",
      "relevantShas": ["33f80b5..."]
    }
  ]
}
```

- `category`: `semantic`, `keyword`, `temporal`, or `negative`. Used as a label
  in the report.
- `relevantShas`: full SHAs. Non-negative cases need at least one; negative cases
  must have none.
- `window` (optional): `{ startDate, endDate }` ISO dates. Without it, the query
  goes through the production scope path, including date parsing from the text.
- `embeddingSpace` (optional): pins the model the labels were judged with. A
  mismatch produces a warning, since metrics are then not comparable.

### Labeling rules

- Label from `git log`, using the commit that introduced or changed the behavior.
- Skip empty commits that the indexing guardrail drops.
- Avoid relative phrases in labels ("last 30 days") so cases stay stable.
- Keep the set small and carefully labeled: about 20 cases, with 8 negatives.

## Running

```bash
cd backend

# Index + embed the dataset branch, then evaluate
pnpm eval --prepare

# Evaluate an already-indexed branch
pnpm eval

# Options
pnpm eval --min-context-recall 0.7 --min-context-precision 0.4
pnpm eval --top-k 10                                              # diagnostic budget
pnpm eval --json | Out-File -Encoding utf8 eval/reports/run.json   # PowerShell
pnpm eval --json > eval/reports/run.json                          # bash
```

Judged SHAs must be indexed. If any are missing, the run fails; use `--prepare`
to index the branch.

## Baselines

| Date | Commit | Embedding model | k | Recall | Precision | MRR | Negative |
|---|---|---|---|---|---|---|---|
| 2026-11-12 | working tree | openai/text-embedding-3-small | 5 | 0.936 | 0.788 | 0.817 | 1.000 |
| 2026-11-12 | working tree | openai/text-embedding-3-small | 10 | 1.000 | 0.743 | 0.817 | 1.000 |

The k=5 row is the MVP budget; k=10 is a diagnostic run. Re-run the same
dataset at the same k before and after a retrieval change. Do not compare across
embedding models.
