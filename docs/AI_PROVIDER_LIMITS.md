# AI providers, models, and limits

This app calls a single server route (`/api/ai` → `app/api/gemini/route.ts`). The **provider** is chosen at runtime from environment variables.

## Configuration (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | **Empty (default):** Gemini-first, then Groq fallback when both are configured. **`gemini`:** Gemini-first explicitly. **`groq`:** Groq-first explicitly. |
| `GROQ_API_KEY` | Must start with `gsk_` — optional secondary provider / fallback |
| `GROQ_MODEL` | Default: `llama-3.1-8b-instant` |
| `GEMINI_API_KEY` | Google AI key (recommended default provider) |
| `GEMINI_MODEL` | Default: `gemini-3.1-flash-lite` |

## Why `llama-3.1-8b-instant` by default on Groq?

- **Fast** and **cheap** for structured JSON (task parse, syllabus structure, short replans).
- Large prompts (full syllabus) are still bounded in code (e.g. truncated) to avoid runaway tokens.

For harder reasoning you can switch to a larger Groq model via `GROQ_MODEL` (check that model’s limits below).

## Groq rate limits (official table, March 2025)

Groq publishes limits per **model** on [Rate limits](https://console.groq.com/docs/rate-limits). **Your org’s exact caps** are on [Settings → Limits](https://console.groq.com/settings/limits). Limits are org-level; you hit whichever threshold comes first (**RPM**, **RPD**, **TPM**, **TPD**).

### `llama-3.1-8b-instant` (default `GROQ_MODEL`)

| Metric | Documented value |
|--------|------------------|
| RPM | 30 requests / minute |
| **RPD** | **14,400 requests / day** |
| TPM | 6,000 tokens / minute |
| TPD | 500,000 tokens / day |

So the **~14k figure** is **requests per day** for this model on the tier Groq documents—not a value hardcoded in this repo.

### Other models (examples from the same doc)

- `llama-3.3-70b-versatile`: RPM 30, **RPD 1,000**, TPM 12k — stricter on **daily requests**.
- `meta-llama/llama-4-scout-17b-16e-instruct`: RPM 30, RPD 1,000, TPM 30k.

Always confirm in your Groq console before relying on numbers in production.

## External formatting (zero server calls)

On the exam planner (step 1), **Copy prompt & open ChatGPT / Gemini** copies a strict “format only, no preamble” instruction plus the user’s syllabus, then opens the site. The student pastes once there and copies the result back. Same quality as manual GPT use without using your API quota for that step.

## Optimal usage for this codebase

1. **Prefer fewer, larger calls where safe** — e.g. one `syllabusBulkStructure` per paste, not per line.
2. **Recovery** (`rebuildWeek`) and **recommendNow** are **one request per user action** — fine if students don’t spam buttons.
3. **Exam planner** can chain calls (`syllabusBulkStructure` → `estimateTopicDurations` → optional `multiExamPlan`) — that’s **3+ requests per plan**; avoid repeated “Build” clicks.
4. On **429** from Groq, back off using `retry-after` (Groq sends it on rate limit responses).
5. **Gemini** limits depend on your Google AI / Cloud plan — check Google’s console for quotas.

## Response headers (Groq)

Groq returns `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, etc. You could log these server-side later for monitoring (not implemented yet).
