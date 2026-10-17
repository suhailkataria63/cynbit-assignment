import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { answers, result, generatedResult } from "../fixtures";
import { BlueprintSectionContent } from "../../src/components/discovery/blueprint-section-content";
import { GenerationDetails } from "../../src/components/discovery/generation-details";
import { blueprintResultSchema, generationBlueprintSchema } from "../../src/lib/blueprint/schema";
import { blueprintText, cleanGroupItem, riskGroups } from "../../src/lib/blueprint/presentation";
import { geminiTokenUsage, groqTokenUsage } from "../../src/lib/blueprint/usage";
import { createBlueprintHandler } from "../../src/lib/blueprint/handler";
import { BlueprintError } from "../../src/lib/blueprint/providers";
import { freshSession, readSession, saveSession, type StorageLike } from "../../src/lib/discovery/storage";
import { generateBlueprint, GenerationRequestError } from "../../src/lib/discovery/generate";

function render(id: string, blueprint = generatedResult.blueprint) { return renderToStaticMarkup(createElement(BlueprintSectionContent, { id, blueprint, lines: [] })); }
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
test("risks render as four distinct headings and numbered lists without redundant prefixes", () => {
  const blueprint = { ...result.blueprint, risks: ["Risk: Risk: Outdated content: verify its freshness."], assumptions: ["Assumption: An agent reviews replies."] };
  const markup = render("risks", blueprint);
  for (const title of ["Risks", "Assumptions", "Missing Information", "Limitations"]) assert.ok(markup.includes(`>${title}</h4>`));
  assert.equal((markup.match(/<ol /g) ?? []).length, 4);
  assert.doesNotMatch(markup, /Risk:|Assumption:/);
  assert.match(markup, /Outdated content: verify its freshness\./);
  assert.equal(cleanGroupItem("A risk: retain this entire sentence.", "risk"), "A risk: retain this entire sentence.");
  assert.equal(riskGroups(blueprint)[1].items[0], "An agent reviews replies.");
});
test("KPI table preserves baselines/targets, labels sources and uses honest legacy missing values", () => {
  const markup = render("benefits");
  for (const title of ["KPI", "Current Baseline", "Proposed Target", "Measurement Method"]) assert.ok(markup.includes(`>${title}</th>`));
  assert.match(markup, /<table /); assert.match(markup, /<ol /);
  assert.match(markup, /Not provided/); assert.match(markup, /User-provided goal/); assert.match(markup, /AI recommendation/);
  assert.match(markup, /not achieved results/);
  const old = render("benefits", result.blueprint);
  assert.match(old, /Not provided/); assert.match(old, /Source not recorded/);
  assert.doesNotMatch(old, /User-provided goal/);
});
test("technology and roadmap use structured values, and absent legacy activities are not invented", () => {
  const stack = render("technology");
  assert.match(stack, /Next\.js/); assert.match(stack, />Purpose<\/dt>/); assert.match(stack, />Justification<\/span>/);
  const roadmap = render("roadmap");
  for (const title of ["Activities", "Deliverables", "Exit criteria"]) assert.ok(roadmap.includes(`>${title}</h5>`));
  assert.doesNotMatch(render("roadmap", result.blueprint), />Activities<\/h5>/);
});
test("provider usage preserves reported zeros and totals; absent/invalid values are null, never estimated", () => {
  assert.deepEqual(groqTokenUsage({ prompt_tokens: 0, completion_tokens: 18 }), { inputTokens: 0, outputTokens: 18, totalTokens: null });
  assert.deepEqual(geminiTokenUsage({ promptTokenCount: 7, candidatesTokenCount: 3, totalTokenCount: 15 }), { inputTokens: 7, outputTokens: 3, totalTokens: 15 });
  assert.deepEqual(groqTokenUsage({ prompt_tokens: -1, completion_tokens: "99", total_tokens: 1.5 }), { inputTokens: null, outputTokens: null, totalTokens: null });
  assert.deepEqual(geminiTokenUsage(undefined), { inputTokens: null, outputTokens: null, totalTokens: null });
});
test("generation panel displays actual supplied metrics and honest missing legacy metadata", () => {
  const markup = renderToStaticMarkup(createElement(GenerationDetails, { details: generatedResult.metadata }));
  assert.match(markup, /1,234/); assert.match(markup, /567/); assert.match(markup, /1,801/); assert.match(markup, /8\.2 seconds/); assert.match(markup, /Success/);
  const legacy = renderToStaticMarkup(createElement(GenerationDetails, { details: result.metadata }));
  assert.match(legacy, /Unavailable/); assert.match(legacy, /no recorded usage metadata/);
  assert.doesNotMatch(legacy, /8\.2 seconds/);
});
test("Phase 3 cache stays byte-for-byte equivalent after parsing, with no generation or migration", async () => {
  assert.deepEqual(blueprintResultSchema.parse(result), result);
  assert.equal(generationBlueprintSchema.safeParse(result.blueprint).success, false);
  assert.equal(generationBlueprintSchema.safeParse(generatedResult.blueprint).success, true);
  const storage = new MemoryStorage(); const session = { ...freshSession(), answers, step: 3, result, view: "results" as const };
  saveSession(storage, session);
  assert.deepEqual(readSession(storage), session);
  let calls = 0;
  await generateBlueprint(session, storage, async () => { calls++; throw new Error("No request allowed"); });
  assert.equal(calls, 0);
  assert.match(blueprintText(result), /Input tokens: Unavailable/);
});
test("handler records duration/timestamp/status and caches original metrics without another request", async () => {
  let calls = 0;
  const handler = createBlueprintHandler({ getConfig: () => ({ provider: "groq", model: "openai/gpt-oss-120b", key: "test-not-real" }), generate: async () => { calls++; return { text: JSON.stringify(generatedResult.blueprint), usage: { inputTokens: 12, outputTokens: 9, totalTokens: null } }; } });
  const id = crypto.randomUUID();
  const request = () => new Request("http://localhost/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, answers }) });
  const first = await (await handler(request())).json();
  assert.equal(first.metadata.usage.inputTokens, 12); assert.equal(first.metadata.usage.totalTokens, null);
  assert.equal(first.metadata.usage.status, "success"); assert.ok(first.metadata.usage.durationMs >= 0);
  assert.ok(Number.isFinite(Date.parse(first.metadata.usage.requestedAt)));
  assert.deepEqual(await (await handler(request())).json(), first); assert.equal(calls, 1);
});
test("failed generation retains available response usage and caches only safe failure details locally", async () => {
  const handler = createBlueprintHandler({ getConfig: () => ({ provider: "groq", model: "openai/gpt-oss-120b", key: "test-not-real" }), generate: async () => { throw new BlueprintError(502, "Incomplete response", { inputTokens: 25, outputTokens: 8, totalTokens: 33 }); } });
  const storage = new MemoryStorage(); const session = { ...freshSession(), answers, step: 3 };
  const transport: typeof fetch = async (_url, init) => handler(new Request("http://localhost/api/blueprint", init));
  await assert.rejects(generateBlueprint(session, storage, transport), GenerationRequestError);
  const cached = readSession(storage)!;
  assert.deepEqual(cached.answers, answers); assert.equal(cached.result, null);
  assert.equal(cached.lastGeneration?.usage.status, "failure"); assert.equal(cached.lastGeneration?.usage.inputTokens, 25);
});

test("new baselines and user-provided target labels require support in the original questionnaire", async () => {
  const { groundKpis } = await import("../../src/lib/blueprint/grounding");
  const grounded = groundKpis(generatedResult.blueprint, answers);
  assert.equal(grounded.kpis[1].baseline, null);
  assert.equal(grounded.kpis[1].targetSource, "needs-clarification");
  assert.equal(grounded.kpis[1].target, generatedResult.blueprint.kpis[1].target);
  const verified = groundKpis(generatedResult.blueprint, { ...answers, success: "Current median 2 hours, supplied by the business; goal: Under 1 hour" });
  assert.equal(verified.kpis[1].baseline, generatedResult.blueprint.kpis[1].baseline);
  assert.equal(verified.kpis[1].targetSource, "user-provided");
  assert.equal(grounded.kpis[2].targetSource, "AI-proposed");
});


test("explicit user KPI targets survive changed AI targets across business contexts", async () => {
  const { groundKpis } = await import("../../src/lib/blueprint/grounding");
  for (const success of ["Reduce screening time by 60%.", "Reach 99.9% service availability.", "Reduce weekly manual work from 20 hours to 8 hours.", "Resolve 80% of support requests within 2 hours."]) {
    const blueprint = { ...generatedResult.blueprint, kpis: [{ metric: "Pilot outcome", target: "40% improvement", targetSource: "user-provided" as const, baseline: "30% today", measurement: "Compare against a measured baseline." }, { metric: "Additional suggestion", target: "Agree on a quality threshold in the pilot", targetSource: "AI-proposed" as const, baseline: null, measurement: "Review a representative sample." }] };
    const grounded = groundKpis(blueprint, { ...answers, success });
    assert.equal(grounded.userSuccessCriteria, success);
    assert.equal(grounded.kpis[0].target, "40% improvement");
    assert.equal(grounded.kpis[0].targetSource, "needs-clarification");
    assert.equal(grounded.kpis[0].baseline, null);
    assert.equal(grounded.kpis[1].targetSource, "AI-proposed");
    const markup = render("benefits", grounded);
    assert.ok(markup.includes(success)); assert.match(markup, /Needs clarification/);
    assert.match(markup, /AI recommendation/); assert.match(markup, /Not provided/);
  }
  assert.equal(blueprintResultSchema.safeParse(result).success, true);
});

test("Studio introduction and architecture preserve supplied prose without invented overview values or flow nodes", () => {
  const summary = render("summary");
  assert.ok(summary.includes(generatedResult.blueprint.executiveSummary));
  assert.match(summary, /Business Challenge/); assert.match(summary, /Recommended Approach/); assert.match(summary, /Target Outcome/);
  assert.doesNotMatch(summary, /Budget|Timeline|INR|USD/);
  const flow = render("architecture");
  assert.ok(flow.includes(generatedResult.blueprint.architecture.overview));
  assert.equal((flow.match(/class="studio-architecture-node"/g) ?? []).length, generatedResult.blueprint.architecture.dataFlow.length);
});

test("Studio technology groups use only supplied roles and retain ambiguous recommendations", async () => {
  const { groupTechnologies } = await import("../../src/components/discovery/studio-content");
  const roles = ["Web interface", "Data storage", "AI inference", "Hosting infrastructure", "Access control", "Unspecified capability"];
  const stack = roles.map(component => ({ ...result.blueprint.techStack[0], component }));
  const groups = groupTechnologies(stack);
  assert.deepEqual(groups.map(group => group.title), ["Application", "Data", "AI / ML", "Infrastructure", "Security", "Other recommendations"]);
  assert.deepEqual(groups.flatMap(group => group.items), stack);
  assert.deepEqual(stack.map(item => item.component), roles);
});

test("five executive sections cover the ten original export sections without mutating their data", async () => {
  const { studioSections } = await import("../../src/components/discovery/studio-content");
  const { blueprintSections } = await import("../../src/lib/blueprint/presentation");
  assert.deepEqual(studioSections.map(section => section.title), ["Overview", "Proposed Solution", "Technical Architecture", "Implementation Plan", "Business Outcomes"]);
  assert.deepEqual(studioSections.flatMap(section => [...section.items]), blueprintSections(generatedResult).map(section => section.id));
  const before = JSON.stringify(generatedResult);
  for (const section of studioSections) assert.ok(render(section.id).length > 0);
  assert.equal(JSON.stringify(generatedResult), before);
});

test("safe report Markdown supports formatting and lists while leaving HTML and unsafe links inert", async () => {
  const { ReportText, CompactText } = await import("../../src/components/discovery/studio-text");
  const text = '**Important** with `code` and *emphasis*\n\n- First item\n- Second item\n\n<script>alert(1)</script> [link](javascript:alert(1))';
  const markup = renderToStaticMarkup(createElement(ReportText, { text }));
  assert.match(markup, /<strong>Important<\/strong>/); assert.match(markup, /<code>code<\/code>/); assert.match(markup, /<em>emphasis<\/em>/); assert.match(markup, /<ul>/);
  assert.doesNotMatch(markup, /<script|<a\s|dangerouslySetInnerHTML/);
  assert.match(markup, /&lt;script&gt;/);
  const long = 'An original recommendation that must remain available in full. '.repeat(10);
  const disclosure = renderToStaticMarkup(createElement(CompactText, { text: long }));
  assert.ok(disclosure.includes(long)); assert.match(disclosure, /<details/); assert.match(disclosure, /…/);
});

test("KPI emphasis uses explicit numbers only and preserves complete long targets and missing-value labels", async () => {
  const { numericTarget } = await import("../../src/components/discovery/studio-content");
  assert.equal(numericTarget('Automate ≥60% of routine inquiries'), '≥60%');
  assert.equal(numericTarget('First response <2 minutes'), '<2 minutes');
  assert.equal(numericTarget('-10% annual variance'), '-10%');
  assert.equal(numericTarget('10–15 days'), '10–15 days');
  assert.equal(numericTarget('<script>alert(60)</script>'), null);
  assert.equal(numericTarget('Automate 60% and respond in 2 minutes'), null);
  assert.equal(numericTarget('Agree a target after a 2 week baseline'), null);
  assert.equal(numericTarget('Needs clarification in 30 days'), null);
  const long = 'Preserve every word of this user-stated goal; establish the measurement approach with the business before evaluating the proposed outcome. '.repeat(3);
  const b = { ...generatedResult.blueprint, kpis: [{ ...generatedResult.blueprint.kpis[0], target: long, targetSource: 'user-provided' as const }, { ...generatedResult.blueprint.kpis[0], target: '' }] };
  const markup = render('benefits', b);
  assert.ok(markup.includes(long)); assert.match(markup, /Full target — exact wording/); assert.match(markup, /Needs clarification/); assert.match(markup, /Not provided/);
  assert.doesNotMatch(markup, /font-serif|<progress/);
});
