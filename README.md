# Cynbit AI Solutions Architect

A guided business discovery and AI blueprint PoC. Reuses Next.js 16, React 19, Tailwind 4, Motion, Lucide, Geist, Cormorant Garamond, and the existing design tokens and UI primitives. No database or authentication.

## Local setup

Use Node.js 22.13+ and npm.

```sh
npm ci
cp .env.example .env.local
# Edit .env.local locally: choose AI_PROVIDER and add that provider's key.
npm run dev
```

Open http://localhost:3000/workspace. Without valid server-side configuration, the questionnaire works and generation returns a safe setup error. No key is needed to build or test. Never put secrets in `NEXT_PUBLIC_*` variables, commit `.env.local`, or enter credentials in the questionnaire. `.env.example` is the only env file permitted by `.gitignore`.

| Server setting | Behavior |
| --- | --- |
| `AI_PROVIDER=groq` | Uses official `groq-sdk`, locked to `openai/gpt-oss-120b`; needs `GROQ_API_KEY` |
| `AI_PROVIDER=gemini` | Uses `@google/genai`, locked to `gemini-2.5-flash-lite`; needs `GEMINI_API_KEY` |
| `BLUEPRINT_SERVER_DAILY_LIMIT=12` | Optional per-process attempted-generation budget per UTC day; positive integer, up to 1,000 |

Only the chosen provider's key is read. Missing/unknown providers fail closed. Neither model IDs nor providers can be chosen by a client request. The response exposes only validated blueprint content and the requested public metadata: selected provider, locked model, generation time, and recorded usage metadata. API keys, SDK error bodies, and internal server configuration are never returned or logged.

`NEXT_PUBLIC_BLUEPRINT_DAILY_LIMIT=12` is an explicitly public browser testing budget. It is fixed into the browser build; rebuild after changing it. It counts attempted POSTs, including failed responses and 429s. It resets on the browser's local calendar day; remaining budget refreshes after generation, storage changes, and every minute. New Discovery clears the discovery but keeps that budget. Invalid quota settings use 12.

## Questionnaire and results

- Business → Challenge → Requirements → review. Back/Next preserve answers and validate the current stage.
- Exactly eight primary fields are required: industry, business description, business problem, current workflow, biggest challenges, intended users, primary goals, success criteria. Choosing Other requires a description of that selection.
- Optional Discovery focus deterministically reveals daily support volume, monthly applications, weekly manual-work hours, or new/existing SaaS product status. This selection makes no AI call. Hidden conditional values are removed before review and generation.
- Flexible is the default timeline. Budget is optional, starts empty, and defaults to INR currency. The currency selector and amount/range persist; specified amounts serialize as `INR 300,000–500,000`, while an empty amount stays unspecified. Available-data Unsure / No data yet options are exclusive.
- Answers, current step, and a successful result are stored under `cynbit.discovery.v3` in localStorage; the attempt ledger uses `cynbit.attempts.v3`. Reloading restores progress/results. Storage is unencrypted and shared by this browser profile: do not enter confidential or personal records. New Discovery overwrites the previous discovery. Corrupt budget records fail closed.
- Generate Blueprint is available only after review. The synchronous click guard, disabled controls, and an origin-wide Web Lock prevent simultaneous generation, including across tabs. Generation requires a current browser with Web Locks on localhost or HTTPS and working localStorage.
- One successful blueprint locks that discovery's answers. Back to Questionnaire allows viewing the saved inputs; use New Discovery to revise them. Viewing, revisiting, copying text, and exporting JSON always use the cached result and never regenerate it.
- If a successful response cannot be saved (for example, browser storage is full), the successful result stays in memory and generation remains locked. Copy/export it before leaving the tab.
- Provider/network/quota errors keep answers and review state intact. Only an explicit subsequent Generate click can attempt again. No automatic retries, continuation calls, provider fallbacks, or model fallbacks exist.

Blueprints include executive summary, problem/requirements analysis, proposed solution/justification, AI/ML feasibility, stack rationale, architecture/data flow, phased roadmap, risks, assumptions, missing information, limitations, benefits/KPIs, and next steps. Expandable sections render text without raw HTML. The generation instructions require grounded recommendations, measurable evaluation plans, explicit unknowns, non-AI options where appropriate, and no invented ROI, prices, savings, or business facts. Zod validates structure and bounds, not truth: human review is still required.

## Request protection and limitations

`POST /api/blueprint` accepts only `{ sessionId, answers }`. There are no LLM calls on entry, navigation, review, page load, cache access, copy, or export. An uncached, valid Generate action makes exactly one provider generation request. Groq uses strict JSON schema; Gemini uses native JSON/schema output. Groq SDK retries are set to zero; Gemini HTTP attempts are set to one and automatic continuation is explicitly disabled. Incomplete responses fail without a repair call.

Limits: 32 KiB streamed input body; five seconds to receive the body; 2,000 characters per long answer; bounded enumerations and numeric values; 55-second generation deadline with abort; 12,000 output tokens; 64 KiB output JSON plus per-field/list bounds. An upstream generation may already be billed when cancellation occurs. Schema validation happens before provider selection/invocation. Raw responses and questionnaire contents are not logged. Responses use `Cache-Control: no-store`.

The server handler maintains a process-wide daily budget (default 12), three attempts per minute, at most two concurrent generations, a pending-session guard, and a 24-hour successful-session cache (bounded to 128 entries). Cached server results return without an LLM call. Cross-origin browser requests are rejected. Limits are deliberately global because the PoC has no trusted proxy or authenticated identity.

**These in-memory limits and idempotency records are not reliable across serverless instances, process restarts, or cache expiry/eviction.** Client localStorage budgets can be cleared or bypassed. Without durable storage/authentication this is basic PoC protection, not a secure paid-usage quota. Deleting local results or calling the API directly after process state is lost can bypass session protection. Before public hosting, use durable shared throttling/idempotency and authenticated access. No deployment is included.

Provider references: [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq SDK retry controls](https://github.com/groq/groq-typescript#retries), [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). Provider availability and free-tier allowances are external; the application does not switch models if a provider rejects the configured model.

## Architecture and changed dependencies

```text
src/app/api/blueprint/route.ts        Node route handler
src/components/workspace/            Existing workspace shell, now wizard controller
src/components/discovery/            Fields, review, expandable results
src/lib/discovery/questionnaire.ts   Shared input schema and deterministic conditions
src/lib/discovery/storage.ts         Versioned local persistence and attempt ledger
src/lib/discovery/generate.ts        Single explicit fetch and cache behavior
src/lib/blueprint/schema.ts          Zod output schema / JSON schema / size limits
src/lib/blueprint/providers.ts       Official SDK adapters and locked models
src/lib/blueprint/handler.ts         Validation, deadline, throttle, safe errors, deduplication
src/lib/blueprint/presentation.ts    Shared display and copy serialization
```

Production additions: `@google/genai`, `groq-sdk`, `zod`. Test-only additions: `tsx` (Node test runner for TypeScript) and `@playwright/test` (desktop/mobile browser tests). Existing framework, typography, component APIs, and build configuration are preserved. Old scripted-chat modules were removed. Homepage illustration remains explicitly illustrative; its workspace links now lead to the questionnaire.

## Verification

```sh
npm run check         # ESLint, route types, TypeScript, production build
npm run test:unit     # mocked official SDK transports, API handler, schemas, storage
npx playwright install chromium  # one-time browser setup
npm run test:e2e      # desktop + mobile browser tests
npm test             # both test suites
npm run build
npm start
```

All automated LLM/provider calls are mocked. SDK tests use injected in-memory HTTP transports; browser tests intercept `/api/blueprint` and the test server has both provider keys and AI_PROVIDER explicitly blanked. Tests consume no real API quota. Browser tests build an isolated production server on port 3101, never reuse a running server, and make no real provider requests.

`next/font/google` fetches fonts at build time and self-hosts them in the output. Existing tooling remains TypeScript 6 / ESLint 9 for Next plugin compatibility. The existing development lint chain has five audit findings; package upgrades outside this phase were not made.

## Phase 4: presentation, provenance, and usage

Existing `cynbit.discovery.v3` entries and questionnaire answers remain valid. No cache key is changed and no migration, reset, or regeneration occurs. New generations require structured KPI baseline/source fields and roadmap activities. Existing cached results can omit them: baselines display **Not provided**, target sources **Source not recorded**, and usage **Unavailable**. Missing legacy roadmap activities are not invented.

Risks, assumptions, missing information, and limitations are separate numbered groups. The visible renderer removes only known redundant leading labels, preserving item text. Technology recommendations use purpose/justification cards; phases show activities (when recorded), deliverables, and exit criteria. Benefits are numbered and KPIs use a horizontally scrollable table on narrow screens. Expandable sections and existing copy/export actions are preserved.

For new generations, instructions require verbatim questionnaire excerpts for known baselines and user-provided goals. The server conservatively checks those excerpts against the supplied answers. A baseline without a matching excerpt becomes null; an unverified user-provided target keeps its full text but is labeled Needs clarification. New blueprints also preserve the supplied success criteria verbatim in a separate user-provided KPI row, so a changed AI recommendation cannot replace them. Older cached labels remain unchanged. Proposed targets remain future recommendations, never achieved outcomes. This check is conservative: paraphrases may be treated as unverified. It does not independently validate the truth of business input. Existing cached content is not rewritten.

The Generation Details panel reads cached metadata from the original generation only:

- Groq: `usage.prompt_tokens`, `completion_tokens`, `total_tokens`.
- Gemini: `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`.
- Elapsed milliseconds measured with the server's monotonic clock, request timestamp, and application generation success/failure status.

Counts are copied as reported, including zero. Missing or invalid counts are null; totals are never calculated from other values and can differ from input + output due to provider accounting. No token-count endpoint, quota lookup, extra LLM call, continuation, or retry is used. Duration covers the generation boundary and response validation, not browser latency. Request timestamps are distinct from completion timestamps.

Usage is optional in `result.metadata.usage` for cache compatibility. New successful results store it alongside the blueprint and include it in copy/export. When an attempted generation fails, sanitized `generationDetails` are returned and retained in the session's optional `lastGeneration` field. Failures with a response can retain reported tokens; transport/timeouts without metadata leave counts null. Input-validation, setup, and local-throttle rejections do not claim a provider invocation. No content or credentials are logged, and no aggregate usage service or database is introduced.

The browser attempt ledger remains separate from actual reported tokens. Neither display represents the provider's authoritative remaining daily quota or monetary charges. Existing serverless/in-memory limitations above still apply. Provider configuration, model locks, local testing budget, and deployment behavior are unchanged.

### Targeted hero, currency, and KPI improvements

The homepage illustration retains its content and geometry. Its decorative background uses slow CSS ring rotation, muted ambient gradients, and four tiny floating particles. The background ignores pointer input, is hidden from assistive technology, reduces detail on mobile, and disables continuous motion when reduced motion is requested.

Timeline and Budget controls have equal heights, aligned desktop labels, helper text below the Budget controls, and a stacked mobile layout. Supported currencies are INR, USD, EUR, GBP, AED, CAD, AUD, SGD, and JPY. The budget remains a string with an optional persisted `budgetCurrency`; old questionnaires need no migration. Legacy Not sure values display as an empty amount. Ambiguous older amounts retain their original text and show Currency not recorded until a currency is chosen; no currency is silently assigned to them.

New blueprints carry a server-supplied optional `userSuccessCriteria` value copied directly from the questionnaire, separate from model-generated KPI proposals. The KPI table retains that full goal, distinguishes AI recommendations and Needs clarification, and never derives a missing baseline. This is deliberately conservative rather than an industry-specific target parser. Existing cached blueprints are not regenerated or rewritten; the preservation row appears for newly generated results only. Provider/model selection, request counts, cache keys, API budgets, and dependencies are unchanged.
