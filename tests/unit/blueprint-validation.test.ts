import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { answers, generatedResult } from "../fixtures";
import { generationBlueprintSchema, blueprintResultSchema } from "../../src/lib/blueprint/schema";
import { createBlueprintHandler } from "../../src/lib/blueprint/handler";
import { BlueprintSectionContent } from "../../src/components/discovery/blueprint-section-content";
import { architectureNodes } from "../../src/components/discovery/architecture-flow";
import { systemPrompt } from "../../src/lib/blueprint/providers";

const concise = {
  ...generatedResult.blueprint,
  executiveSummary: "Pilot reviewed replies.",
  analysis: { problem: "Manual replies.", requirements: [] },
  solution: { proposal: "Agent review.", justification: "Preserve control." },
  feasibility: { recommendation: "Non-AI" as const, rationale: "Manual review is sufficient.", dataReadiness: "Not confirmed." },
  techStack: [],
  architecture: { overview: "Review replies.", dataFlow: ["Agent review."], stepDetails: [] },
  roadmap: [{ phase: "Pilot", activities: [], deliverables: ["Reviewed sample."], exitCriteria: "Sample reviewed." }],
  risks: [], assumptions: [], missingInformation: [], limitations: [], benefits: [], kpis: [], nextSteps: [],
};

test("concise complete blueprints and empty optional-information lists pass without invented content", () => {
  const parsed = generationBlueprintSchema.parse(concise);
  assert.deepEqual(parsed, concise);
  assert.deepEqual(blueprintResultSchema.parse({ ...generatedResult, blueprint: concise }).blueprint, concise);
  for (const id of ["overview", "proposed-solution", "technical-architecture", "implementation-plan", "business-outcomes"]) {
    const markup = renderToStaticMarkup(createElement(BlueprintSectionContent, { id, blueprint: parsed, lines: [] }));
    assert.ok(markup.length > 0);
    assert.doesNotMatch(markup, /undefined|NaN/);
  }
  assert.deepEqual(architectureNodes(concise.architecture, [] ).map(node => node.description), concise.architecture.dataFlow);
});

test("variable-length lists and long complete explanations remain valid and render all supplied items", () => {
  const long = "An explanation. ".repeat(180);
  const phase = concise.roadmap[0];
  const b = {
    ...generatedResult.blueprint, executiveSummary: long,
    analysis: { ...concise.analysis, requirements: Array.from({ length: 12 }, (_, index) => `Requirement ${index + 1}.`) },
    roadmap: Array.from({ length: 7 }, (_, index) => ({ ...phase, phase: `Phase ${index + 1}` })),
    kpis: Array.from({ length: 8 }, (_, index) => ({ ...generatedResult.blueprint.kpis[0], metric: `Outcome ${index + 1}`, target: "A proposed target. ".repeat(25) })),
  };
  const parsed = generationBlueprintSchema.parse(b);
  const roadmap = renderToStaticMarkup(createElement(BlueprintSectionContent, { id: "roadmap", blueprint: parsed, lines: [] }));
  assert.equal((roadmap.match(/class="studio-phase-marker"/g) ?? []).length, 7);
  const outcomes = renderToStaticMarkup(createElement(BlueprintSectionContent, { id: "benefits", blueprint: parsed, lines: [] }));
  for (const kpi of b.kpis) assert.ok(outcomes.includes(kpi.metric));
  assert.equal(parsed.executiveSummary, long.trim());
});

test("missing required sections, incorrect types, blank essential text and incomplete core plans stay rejected", () => {
  for (const key of Object.keys(concise)) {
    const missing: Record<string, unknown> = { ...concise };
    delete missing[key];
    assert.equal(generationBlueprintSchema.safeParse(missing).success, false, key);
  }
  const invalid = [
    { ...concise, executiveSummary: "   " },
    { ...concise, benefits: "A string is not a list." },
    { ...concise, architecture: { ...concise.architecture, dataFlow: [] } },
    { ...concise, architecture: { ...concise.architecture, stepDetails: [{ title: "Review" }] } },
    { ...concise, roadmap: [] },
    { ...concise, roadmap: [{ ...concise.roadmap[0], deliverables: [] }] },
    { ...concise, feasibility: { ...concise.feasibility, recommendation: "Unsupported choice" } },
  ];
  for (const b of invalid) assert.equal(generationBlueprintSchema.safeParse(b).success, false);
});

test("the logged step-details count mismatch now succeeds once and preserves every summary and detail", async () => {
  const step = generatedResult.blueprint.architecture.stepDetails![0];
  const architecture = { ...generatedResult.blueprint.architecture, stepDetails: [step, { ...step, title: "Review the draft", process: "An agent reviews the proposed reply." }] };
  const nodes = architectureNodes(architecture, []);
  assert.deepEqual(nodes.map(node => node.details.title), architecture.stepDetails.map(detail => detail.title));
  assert.deepEqual(nodes.map(node => node.description), architecture.stepDetails.map(detail => detail.process));
  const before = JSON.stringify(architecture);
  let calls = 0;
  const handler = createBlueprintHandler({ getConfig: () => ({ provider: "groq", model: "openai/gpt-oss-120b", key: "test-not-real" }), generate: async () => {
    calls++;
    return { text: JSON.stringify({ ...concise, architecture }), usage: { inputTokens: 1538, outputTokens: 2245, totalTokens: 3783 } };
  } });
  const sessionId = crypto.randomUUID();
  const request = () => new Request("http://localhost/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, answers }) });
  const response = await handler(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.blueprint.architecture, architecture);
  assert.equal(body.metadata.usage.outputTokens, 2245);
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(architecture), before);
  const markup = renderToStaticMarkup(createElement(BlueprintSectionContent, { id: "architecture", blueprint: body.blueprint, lines: [] }));
  for (const summary of architecture.dataFlow) assert.ok(markup.includes(summary));
  assert.equal((markup.match(/class="studio-architecture-node"/g) ?? []).length, 2);
});

test("prompt distinguishes mandatory structure from flexible presentation without rigid quotas", () => {
  assert.match(systemPrompt, /different number of entries/);
  assert.match(systemPrompt, /at least one roadmap phase/);
  assert.match(systemPrompt, /empty arrays for optional-information lists/);
  assert.doesNotMatch(systemPrompt, /exactly one stepDetails|Respect field limits|1–8|1–5|1–6|1,500|2–5|3–4/);
});

test("flexible presentation does not repair malformed JSON or accept an incomplete response", async t => {
  t.mock.method(console, "error", () => {});
  for (const raw of ['{"executiveSummary":', JSON.stringify({ executiveSummary: "A summary alone is incomplete." })]) {
    let calls = 0;
    const handler = createBlueprintHandler({ getConfig: () => ({ provider: "groq", model: "openai/gpt-oss-120b", key: "test-not-real" }), generate: async () => {
      calls++; return { text: raw, usage: { inputTokens: null, outputTokens: null, totalTokens: null } };
    } });
    const response = await handler(new Request("http://localhost/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: crypto.randomUUID(), answers }) }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).generationDetails.usage.status, "failure");
    assert.equal(calls, 1);
  }
});
