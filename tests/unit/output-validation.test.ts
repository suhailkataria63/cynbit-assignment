import { test } from "node:test";
import assert from "node:assert/strict";
import { answers, generatedResult } from "../fixtures";
import { completionMetadata, schemaIssueDiagnostics } from "../../src/lib/blueprint/diagnostics";
import { createBlueprintHandler } from "../../src/lib/blueprint/handler";
import { BlueprintError, createGenerator, models, type Generate } from "../../src/lib/blueprint/providers";
import { blueprintJsonSchema, generationBlueprintSchema, OUTPUT_TOKENS } from "../../src/lib/blueprint/schema";

const config = { provider: "groq" as const, model: models.groq, key: "gsk_private_test_only" };
const usage = { inputTokens: 1538, outputTokens: 2841, totalTokens: 4379 };
function request() { return new Request("http://localhost/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: crypto.randomUUID(), answers }) }); }
async function environment(mode: string, run: () => Promise<void>) {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: mode });
  try { await run(); } finally { if (previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: previous }); }
}

test("presentation lengths, duplicate wording and independent architecture list counts do not invalidate complete JSON", () => {
  const b = generatedResult.blueprint;
  const step = b.architecture.stepDetails![0];
  const candidates = [
    { ...b, architecture: { ...b.architecture, stepDetails: [{ ...step, title: "x".repeat(151) }] } },
    { ...b, architecture: { ...b.architecture, stepDetails: [step, step] } },
    { ...b, architecture: { ...b.architecture, stepDetails: [{ ...step, process: step.title }] } },
  ];
  for (const candidate of candidates) assert.equal(generationBlueprintSchema.safeParse(JSON.parse(JSON.stringify(candidate))).success, true);
  const schema = blueprintJsonSchema as { properties: { architecture: { properties: { stepDetails: { items: { properties: { title: object } } } } } } };
  assert.equal(Object.hasOwn(schema.properties.architecture.properties.stepDetails.items.properties.title, "maxLength"), false);
});

test("development diagnostics identify schema fields while keeping response statistics and errors unchanged", async t => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  await environment("development", async () => {
    let calls = 0;
    const b = generatedResult.blueprint;
    const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => {
      calls++;
      return { text: JSON.stringify({ ...b, feasibility: { recommendation: b.feasibility.recommendation, rationale: b.feasibility.rationale } }), usage, completion: completionMetadata("stop") };
    } });
    const response = await handler(request());
    assert.equal(response.status, 502); assert.equal(calls, 1);
    const body = await response.json();
    assert.match(body.error, /invalid or incomplete blueprint/);
    assert.equal(body.generationDetails.usage.inputTokens, 1538); assert.equal(body.generationDetails.usage.outputTokens, 2841);
    assert.equal(body.generationDetails.usage.status, "failure");
    assert.equal(body.diagnostic, undefined); assert.equal(body.generationDetails.finishReason, undefined);
    const diagnostic = JSON.parse(logs.find(args => args[0] === "blueprint_output_diagnostics")![1] as string);
    assert.equal(diagnostic.stage, "schema_validation"); assert.equal(diagnostic.jsonParsing, "succeeded");
    assert.equal(diagnostic.finishReason, "stop"); assert.equal(diagnostic.truncated, false);
    assert.equal(diagnostic.outputTokenLimit, OUTPUT_TOKENS);
    assert.deepEqual(diagnostic.schemaIssues, [{ path: "feasibility.dataReadiness", code: "invalid_type", expected: "string" }]);
    assert.equal(diagnostic.schemaIssueCount, 1);
    assert.doesNotMatch(JSON.stringify(logs), /gsk_private_test_only|Agents spend time|We sell household/);
  });
});

test("JSON failures and provider-reported truncation have separate development diagnostics with no retry", async t => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  await environment("development", async () => {
    const cases: Generate[] = [
      async () => ({ text: '{"SENSITIVE_BLUEPRINT":"private unfinished content",', usage, completion: completionMetadata("stop") }),
      createGenerator(async () => Response.json({ choices: [{ finish_reason: "length", message: { content: '{"SENSITIVE_BLUEPRINT":' } }], usage: { prompt_tokens: 1538, completion_tokens: 2841, total_tokens: 4379 } })),
    ];
    for (const [index, generate] of cases.entries()) {
      let calls = 0;
      const handler = createBlueprintHandler({ getConfig: () => config, generate: async (...args) => { calls++; return generate(...args); } });
      const response = await handler(request()); assert.equal(response.status, 502); assert.equal(calls, 1);
      const diagnostic = JSON.parse(logs.filter(args => args[0] === "blueprint_output_diagnostics").at(-1)![1] as string);
      assert.equal(diagnostic.stage, index === 0 ? "json_parse" : "provider_response");
      assert.equal(diagnostic.jsonParsing, index === 0 ? "failed" : "not_attempted");
      assert.equal(diagnostic.truncated, index === 1);
      assert.equal(diagnostic.finishReason, index === 0 ? "stop" : "length");
      assert.deepEqual(diagnostic.schemaIssues, []);
      assert.equal((await response.json()).generationDetails.usage.outputTokens, 2841);
    }
    assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE_BLUEPRINT|private unfinished|gsk_private_test_only/);
  });
});

test("detailed diagnostics stay disabled outside development; raw Zod values and property names stay private", async t => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  for (const mode of ["production", "test"]) await environment(mode, async () => {
    const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => ({ text: "{}", usage, completion: completionMetadata("stop") }) });
    assert.equal((await handler(request())).status, 502);
  });
  assert.equal(logs.filter(args => args[0] === "blueprint_output_diagnostics").length, 0);
  const sanitized = schemaIssueDiagnostics([
    { code: "invalid_value", path: ["feasibility", "recommendation"], message: "secret enum value" },
    { code: "unrecognized_keys", path: ["gsk_private_test_only"], message: "private unknown key" },
    { code: "custom", path: ["architecture", "stepDetails", 0, "process"], message: "private content" },
  ]);
  assert.equal(sanitized[1].path, "[unrecognized]");
  assert.doesNotMatch(JSON.stringify(sanitized), /secret|private/);
  assert.deepEqual(completionMetadata("gsk_private_test_only"), { finishReason: null, truncated: null });
  assert.deepEqual(completionMetadata("MAX_TOKENS"), { finishReason: "MAX_TOKENS", truncated: true });
  assert.deepEqual(completionMetadata("SAFETY"), { finishReason: "SAFETY", truncated: null });
});

test("both SDKs preserve finish metadata server-side in one mocked request", async () => {
  for (const provider of ["groq", "gemini"] as const) {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return Response.json(provider === "groq" ? { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(generatedResult.blueprint) } }] } : { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify(generatedResult.blueprint) }] } }] });
    };
    const result = await createGenerator(transport)(answers, { ...config, provider, model: models[provider] }, new AbortController().signal);
    assert.equal(calls, 1);
    assert.deepEqual(result.completion, { finishReason: provider === "groq" ? "stop" : "STOP", truncated: false });
  }
  const failure = new BlueprintError(502, "Safe fixed message", usage, completionMetadata("length"));
  assert.equal(failure.completion?.truncated, true);
});
