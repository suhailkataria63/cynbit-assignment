# Cynbit AI Solutions Architect

An AI-powered business discovery and solution-planning proof of concept, prepared for an **AI/ML Engineer Internship assessment**. Cynbit turns a guided business questionnaire into a structured, reviewable solution blueprint—not an implemented business system.

**Live deployment:** Pending — replace this placeholder with the public HTTPS URL after deployment.

## Overview and business opportunity

Businesses can identify operational problems without knowing whether they need automation, conventional software, or AI. Early discovery often leaves requirements, integration constraints, success measures, and implementation assumptions scattered across conversations.

Cynbit provides a consistent discovery workflow and generates an initial blueprint grounded in those answers. It helps business stakeholders and engineers discuss feasibility, architecture, delivery phases, and measurable goals before committing to implementation. Recommendations are planning assistance: they require human validation and do not establish achieved savings, ROI, or delivery feasibility.

## Main features

- **Guided discovery:** Business, Challenge, and Requirements stages with validation, review, Back/Next navigation, and locally saved progress. Deterministic conditional questions support different discovery focuses without making AI calls.
- **Optional budget and constraints:** Currency plus free-text amount/range, timeline, integrations, available data, and security requirements. An empty budget remains unspecified.
- **AI-generated blueprints:** One explicit Generate action requests a structured report containing business analysis, proposed solution, AI/ML feasibility, stack rationale, architecture, roadmap, risks, assumptions, benefits, KPIs, and next steps. Non-AI solutions can be recommended when appropriate.
- **Blueprint Studio:** Five executive-facing sections, collapsible desktop navigation, a mobile section selector, expandable technical details, and light/dark themes.
- **Architecture visualization:** Selectable, ordered data-flow steps and connectors. Business View emphasizes saved step purpose; Technical View exposes available inputs, processing, outputs, and technologies. Older blueprints retain their original architecture text when structured details are absent. Switching views makes no AI request.
- **KPI cards and table:** User-provided goals, AI recommendations, and clarification needs are distinguished. Unknown baselines remain “Not provided.” Original user success criteria are retained; proposed targets are not presented as achieved outcomes.
- **Cached results and export:** Copy the report as text or download `cynbit-blueprint.json`. Viewing, copying, exporting, or revisiting a saved result does not regenerate it. A successful discovery is locked; New Discovery starts a new local session.
- **Generation details:** Provider, model, request timestamp, duration, status, and actual token counts where supplied by the provider. Missing usage stays unavailable rather than being estimated.

### Report organization

The UI groups the existing blueprint data without discarding the underlying sections:

| Studio section | Included content |
| --- | --- |
| 01 Overview | Executive summary; problem and requirements |
| 02 Proposed Solution | Recommendation and justification; AI/ML feasibility |
| 03 Technical Architecture | Technology stack; architecture and data flow |
| 04 Implementation Plan | Phased roadmap; risks, assumptions, missing information, limitations |
| 05 Business Outcomes | Expected benefits; measurable KPIs; next steps |

## Technology stack

Versions below are pinned in [package.json](package.json) and [package-lock.json](package-lock.json).

| Layer | Implemented technology |
| --- | --- |
| Application | Next.js 16.4.2 App Router; React 19.3.1; TypeScript 6.0.3 |
| Styling | Tailwind CSS 4.3.3; centralized CSS design/theme tokens; Geist and Cormorant Garamond via `next/font` |
| Interaction | Motion 14.3.0; Lucide React 1.59.0; accessible native controls and reduced-motion support |
| Validation | Zod 4.6.7; input validation and structured output validation |
| Demonstrated AI adapter | Official `groq-sdk` 1.6.0; locked model **`openai/gpt-oss-120b`** |
| Optional AI adapter | Official `@google/genai` 2.30.0; locked model **`gemini-2.5-flash-lite`** |
| Testing and checks | Node test runner through `tsx`; Playwright; ESLint; TypeScript; Next.js production build |
| Persistence | Browser localStorage; bounded, in-memory server session cache and request counters |

There is no database, authentication, model training, retrieval pipeline, or live business-service connector. Technologies and integrations proposed inside a blueprint are recommendations, not capabilities already connected to this application.

## System architecture

```text
Browser: questionnaire → validation → review → explicit Generate
   │                                  │
   │ localStorage: draft, attempts,    │ POST /api/blueprint
   │ successful blueprint + metadata  ▼
   │                         Node.js route / request handler
   │                         input validation, cache, usage guards
   │                                  │
   │                         ONE selected provider request
   │                         Groq OR optional Gemini
   │                                  │
   │                         completion / JSON / Zod validation
   │                         KPI grounding + usage metadata
   │                                  │
   └────────────── saved result ◀──────┘
                   Blueprint Studio → copy / JSON export
```

The client submits only a session ID and answers. Provider selection and model IDs are server-controlled. Groq uses strict JSON-schema output; Gemini uses native JSON/schema output. Neither adapter has automatic retries, repair calls, continuation calls, or provider/model fallback. Entry, navigation, review, and page load do not call an LLM. A valid, uncached generation makes one provider request; a server cache hit makes none.

The server verifies completion, parses JSON, validates required structure, and applies conservative KPI grounding against supplied answers. Short descriptions and variable-length lists are accepted where structurally valid; missing required sections are rejected rather than fabricated. Validation establishes structure, not factual correctness. The provider receives questionnaire answers only on generation and is not given tools to access Shopify, WhatsApp, or other external services.

### Repository map

```text
docs/                                  Assessment reports (PDF)
src/app/                              Homepage, workspace, global styles
src/app/api/blueprint/route.ts         Node.js API entry point
src/components/discovery/             Questionnaire and Blueprint Studio UI
src/components/workspace/             Discovery workflow controller
src/components/marketing/             Homepage components
src/components/ui/                    Shared controls and theme toggle
src/lib/discovery/                    Input schema, budget, local storage, generation client
src/lib/blueprint/                     Output schema, providers, handler, grounding, usage
src/styles/tokens.css                 Shared design and theme tokens
tests/unit/                           Validation, provider, persistence, presentation tests
tests/e2e/                            Browser discovery, Studio, architecture, theme tests
```

## Installation and environment configuration

Requirements: **Node.js 22.13.0 or newer** and npm. A clean build downloads the configured Google fonts, so network access is required for that step.

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local` locally using the blank [.env.example](.env.example) template:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=
NEXT_PUBLIC_BLUEPRINT_DAILY_LIMIT=12
BLUEPRINT_SERVER_DAILY_LIMIT=12
```

The key above is a placeholder, not a credential. To use the optional Gemini adapter, set `AI_PROVIDER=gemini` and supply `GEMINI_API_KEY` instead. Only the selected provider's key is used. The demonstrated request below used Groq; it does not establish Gemini runtime performance.

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Required for generation: `groq` or `gemini`; missing/unknown values fail closed |
| `GROQ_API_KEY` | Server-only key required when Groq is selected |
| `GEMINI_API_KEY` | Server-only key required when Gemini is selected |
| `NEXT_PUBLIC_BLUEPRINT_DAILY_LIMIT` | Public browser attempt budget; default 12 per local calendar day, configured at build time |
| `BLUEPRINT_SERVER_DAILY_LIMIT` | Server process-wide attempt budget; default 12 per UTC day |

Restart the server after changing server configuration; rebuild after changing the public browser budget. API keys must never use a `NEXT_PUBLIC_` prefix or be placed in client code. No provider key is needed to build, run automated tests, or complete the questionnaire; real generation requires valid configuration and provider access.

## Local development and testing

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the homepage or [localhost:3000/workspace](http://localhost:3000/workspace) for discovery.

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next.js route types and run TypeScript without emitting files |
| `npm run build` | Optimized production build |
| `npm run check` | Lint, typecheck, and production build |
| `npm run test:unit` | Unit tests through `tsx` and the Node test runner |
| `npm run test:e2e` | Playwright desktop and mobile browser tests |
| `npm test` | Unit tests followed by E2E tests |
| `npm run start` | Serve an existing production build |

Before running browser tests for the first time:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright builds and starts an isolated production server at `127.0.0.1:3101`; leave that port free. Tests use saved blueprint fixtures, intercepted application requests, and mocked provider transports. The test server blanks provider credentials, and automated tests do not consume live AI quota. Coverage includes validation, request guards, usage extraction, legacy results, KPI grounding, architecture views, navigation, exports, themes, and responsive/reduced-motion behavior. Running the commands is required to establish results for a particular checkout; coverage is not a claim of perfect reliability.

## One documented successful request

The assessment records the following **single successful Groq request**:

| Measurement | Recorded value |
| --- | --- |
| Provider | Groq |
| Model | `openai/gpt-oss-120b` |
| Input tokens | 1,601 |
| Output tokens | 2,612 |
| Total tokens | 4,213 |
| Generation duration | 6.018 seconds (6,018 ms) |

These are the supplied results of **one successful request**, not benchmark averages, latency guarantees, or a multi-run evaluation. This request was not repeated during the documentation review. The application records token counts from provider response metadata without estimating missing counts; its generation duration is measured server-side and is not total browser-perceived latency. Browser attempt tracking is separate from provider usage. The application does not know an authoritative remaining provider quota or actual monetary charges.

## Assessment reports

- [AI Opportunity Report](docs/ai-opportunity-report.pdf)
- [Technical Approach Report](docs/technical-approach-report.pdf)

These are unchanged copies of the supplied PDFs in `reports/`. This README describes the current implementation; proposed capabilities in the reports should not be interpreted as already implemented integrations.

## Security and usage controls

- Credentials stay server-side. Safe error responses do not expose API keys, raw SDK responses, or internal configuration. Server diagnostics avoid logging questionnaire content and credentials; development-only output diagnostics identify parsing, completion, and schema-field failures without logging generated text.
- Inputs are schema-validated and the streamed request body is limited to 32 KiB with a five-second body deadline. Generation has a 55-second deadline, a 12,000-token output budget, and a 64 KiB JSON output limit. An aborted or rejected provider response can still incur upstream usage.
- Basic server controls include the configurable daily budget, three attempted generations per minute, at most two concurrent generations, a pending-session guard, and a 24-hour successful-session cache bounded to 128 entries. Responses use `Cache-Control: no-store`; supplied cross-origin browser origins are rejected.
- The browser requires working localStorage and Web Locks on localhost or HTTPS for generation. Attempted submissions, including errors and 429 responses, count against its budget. New Discovery does not reset the daily counter. Errors preserve answers and require an explicit user action to try again.
- Drafts and blueprints are **unencrypted browser-local data**, not private cloud storage. Do not enter secrets, personal customer records, or confidential data. Questionnaire answers are sent to the selected external AI provider on generation. JSON exports may contain business-sensitive information and should be handled accordingly.
- `.gitignore` excludes environment files except the blank `.env.example`, common private-key containers, local blueprint exports, dependency/build output, and test artifacts. Keep any additional credentials or local datasets outside version control. Ignore rules do not remove files already tracked or protect credentials entered into arbitrary files.

## Limitations and future improvements

This is an unauthenticated planning PoC. In-memory server limits and session idempotency are **not reliable across serverless instances, restarts, cache eviction, or expiry**. Browser budgets can be cleared or bypassed. They are testing safeguards, not a durable security or billing boundary; unrestricted public hosting needs stronger controls.

AI output can be incomplete or incorrect despite structural validation. Business targets are intentions, not measured results. Baselines, budget/timeline feasibility, external API capabilities, and compliance assumptions need stakeholder and engineering review. Legacy blueprints may lack detailed architecture fields or recorded KPI sources. The diagram presents saved step order rather than a verified executable dependency graph.

Local storage holds one discovery per browser profile, with no accounts, cross-device sync, durable server history, or collaborative editing. Exports are text copy and JSON only. There is no document ingestion, retrieval-augmented generation, live connector execution, or deployment automation.

Potential next steps, **not implemented features**, include authenticated access, shared durable throttling/idempotency, explicit retention and deletion controls, saved-report history, broader quality/grounding evaluations, and permissioned integrations with independently verified API contracts. Any real business deployment also needs a privacy, security, and accessibility review appropriate to its users and data.
