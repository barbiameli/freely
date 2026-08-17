# Cache market-rate research in Postgres, not a new cache service

`generateBriefFromDraft` calls Claude's `web_search` tool to research market rates whenever a freelancer has no pricing history or gave no rate — adding real latency to the slowest, most-used LLM call. Market rates for a given industry/currency/rate-unit move slowly (quarters, not days), so the same research is being redone for every freelancer who happens to share that combination.

We're caching results in a Postgres table keyed by `(industry, currency, rateUnit)`, refreshed on a quarterly cadence, rather than introducing Redis/Vercel KV or any other cache service. Freely already runs Postgres locally (`docker-compose.yml`) and in production (Neon); adding a table costs nothing new to operate, while a cache service would be new infrastructure to run, pay for, and keep available on an unpaid Vercel tier — for data that doesn't need sub-millisecond reads.

`currency` is a rough proxy for region (one currency can span many countries), accepted deliberately rather than adding a new region/country field pre-launch.
