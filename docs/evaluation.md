# Retrieval Evaluation

Retrieval is the core of Scrapecat, so changes to it need a baseline. The eval
harness runs a **golden set** — a versioned list of queries and the commits that
should answer them — through the real retriever and reports ranking metrics.

## Why

- **Falsifiable changes.** `MAX_COSINE_DISTANCE`, `RETRIEVAL_LIMIT`, temporal
  fallbacks, and future reranking can be compared against a measured baseline
  instead of intuition.
- **Regression safety.** A question the system could answer yesterday should not
  silently break today.
- **Triage.** If an expected commit is absent from the citations, the failure is
  retrieval; if it is present, the failure is generation.
- **A gate for P1-4.** Reranking/hybrid scoring is only worth shipping if it
  improves the numbers.

The harness measures retrieval only. Answer quality (LLM grading) is out of
scope for now: it is nondeterministic and would blur retrieval vs. generation.

## Metrics

All metrics use the first `k` (default 10) retrieved SHAs and the case's judged
`relevantShas`:

- **Recall@k** — fraction of judged relevant commits retrieved.
- **Precision@k** — fraction of the top `k` slots that are relevant.
- **MRR** — reciprocal rank of the first relevant commit.
- **nDCG@k** — rank-weighted quality with binary relevance.
- **Negative accuracy** — fraction of `negative` cases that return zero results.

Because labels are not exhaustive, recall is measured against the judged set,
not every possible relevant commit.

## Dataset format

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
  "embeddingSpace": {
    "provider": "openrouter",
    "model": "openai/text-embedding-3-small"
  },
  "cases": [
    {
      "id": "gitlab-support",
      "query": "When did we add support for GitLab repositories?",
      "category": "semantic",
      "relevantShas": ["33f80b5..."],
      "window": {
        "startDate": "2026-10-01T00:00:00.000Z",
        "endDate": "2026-10-31T23:59:59.999Z"
      },
      "notes": "optional"
    }
  ]
}
```

- `category` is `semantic`, `keyword`, `temporal`, or `negative`.
- `relevantShas` are full commit SHAs. Non-negative cases need at least one;
  negative cases must have none.
- `window` is optional. Without it, the harness uses the production
  `resolveScope` path (including natural-language date parsing). With it, the
  harness calls `retrieve` with the explicit window.
- `embeddingSpace` pins the vectors the labels were judged against. Running with
  a different model is allowed but the harness warns that results are not
  comparable.

### Labeling rules

- Label from the actual commit history (`git log`), using the commit that
  introduced or changed the behavior.
- Prefer multiple relevant SHAs when a feature spans several commits.
- Skip empty/junk commits that the ingestion guardrail drops.
- Keep cases stable: avoid relative windows ("last 30 days") for temporal cases;
  use a month/year or an explicit `window`.

## Running

```bash
cd backend

# Ingest + embed the dataset branch, then evaluate
pnpm eval --prepare

# Evaluate against an already-indexed project
pnpm eval

# Useful options
pnpm eval --top-k 5 --min-recall 0.7
pnpm eval --dataset eval/datasets/other.json --json --out eval/reports/other.json
```

Requirements: a reachable Postgres with the dataset branch ingested, and a
working embedding provider (`OPENROUTER_API_KEY`, Ollama, or a stored
credential). If embeddings are missing, retrieval falls back to keyword search
and the harness warns.

The eval service validates every judged SHA against `commit_chunks` before scoring, so
a stale dataset fails loudly instead of producing misleading metrics. Use
`--allow-missing` only while repairing labels.

## Baselines

Record the commit, embedding model, and summary metrics after each meaningful
retrieval change:

| Date | Commit | Embedding model | k | Recall | MRR | nDCG | Negative |
|---|---|---|---|---|---|---|---|
| _pending first run_ | — | openai/text-embedding-3-small | 10 | — | — | — | — |

Re-run the same dataset before and after a retrieval change. Do not compare
across embedding models without re-labeling or acknowledging the mismatch.
