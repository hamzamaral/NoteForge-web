# ADR 0003 — Search via Postgres ILIKE (then Meilisearch)

## Decision
Phase 7 search uses title `contains` + `Block.props::text ILIKE`, ranked with match type (title > task > content) and optional snippet. Meilisearch is deferred.

## Why
Demo workspaces are small; zero extra infra. Snippet + score is enough for interview demos. Index service lands when corpus size or latency demands it.
