import { test } from "node:test";
import assert from "node:assert/strict";
import { answers, generatedResult as result } from "../fixtures";
import { createBlueprintHandler } from "../../src/lib/blueprint/handler";
import { BlueprintError, createGenerator, models, providerConfig, type ProviderConfig } from "../../src/lib/blueprint/providers";
import { blueprintSchema } from "../../src/lib/blueprint/schema";

const config: ProviderConfig = { provider: "groq", model: models.groq, key: "test-key-not-real" };
function request(sessionId = crypto.randomUUID(), body: unknown = { sessionId, answers }) { return new Request("http://localhost/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

test("provider configuration fails closed and selects only specified provider/models", () => {
  assert.throws(() => providerConfig({}), BlueprintError);
  assert.throws(() => providerConfig({ AI_PROVIDER: "other", GROQ_API_KEY: "test" }), BlueprintError);
  assert.throws(() => providerConfig({ AI_PROVIDER: "gemini", GROQ_API_KEY: "test" }), BlueprintError);
  assert.equal(providerConfig({ AI_PROVIDER: "groq", GROQ_API_KEY: "test" }).model, models.groq);
  assert.equal(providerConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "test" }).model, models.gemini);
});
test("input validation, model injection, cross-origin, and size guards reject without an LLM call", async () => {
  let calls = 0;
  const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => { calls++; return { text: JSON.stringify(result.blueprint), usage: { inputTokens: null, outputTokens: null, totalTokens: null } }; } });
  assert.equal((await handler(request(undefined, { sessionId: crypto.randomUUID(), answers: {} }))).status, 400);
  assert.equal((await handler(request(undefined, { sessionId: crypto.randomUUID(), answers, model: "other" }))).status, 400);
  assert.equal((await handler(request(undefined, { sessionId: crypto.randomUUID(), answers: { ...answers, description: "x".repeat(40000) } }))).status, 413);
  const cross = request(); cross.headers.set("origin", "https://other.example"); assert.equal((await handler(cross)).status, 403);
  assert.equal(calls, 0);
});
test("concurrent duplicate is rejected, success is cached, same session cannot generate again", async () => {
  let calls = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => { calls++; await gate; return { text: JSON.stringify(result.blueprint), usage: { inputTokens: null, outputTokens: null, totalTokens: null } }; } });
  const id = crypto.randomUUID(); const first = handler(request(id));
  while (!calls) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await handler(request(id))).status, 409);
  release(); const response = await first; assert.equal(response.status, 200);
  const output = await response.json(); assert.equal(output.metadata.provider, "groq"); assert.equal(output.metadata.model, models.groq);
  assert.equal((await handler(request(id))).status, 200); assert.equal(calls, 1);
});
test("provider quota errors are sanitized, counted, and never retried", async () => {
  let calls = 0;
  const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => { calls++; throw { status: 429, message: "secret-key and questionnaire" }; }, limit: 1 });
  const response = await handler(request()); assert.equal(response.status, 429);
  assert.doesNotMatch(await response.text(), /secret-key|questionnaire/);
  assert.equal((await handler(request())).status, 429); assert.equal(calls, 1);
});
test("in-memory burst throttle blocks the fourth request; invalid output is not cached", async () => {
  let calls = 0;
  const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => { calls++; return { text: "{}", usage: { inputTokens: null, outputTokens: null, totalTokens: null } }; } });
  for (let i = 0; i < 3; i++) assert.equal((await handler(request())).status, 502);
  assert.equal((await handler(request())).status, 429); assert.equal(calls, 3);
});
test("timeout aborts provider, malformed/truncated/oversized JSON fails output validation", async () => {
  let aborted = false;
  const slow = createBlueprintHandler({ getConfig: () => config, timeoutMs: 5, generate: async (_a, _c, signal) => { signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); } });
  assert.equal((await slow(request())).status, 504); assert.equal(aborted, true);
  for (const raw of ['{"executiveSummary":', "x".repeat(65537), JSON.stringify({ ...result.blueprint, architecture: { ...result.blueprint.architecture, dataFlow: [] } })]) {
    const handler = createBlueprintHandler({ getConfig: () => config, generate: async () => ({ text: raw, usage: { inputTokens: null, outputTokens: null, totalTokens: null } }) });
    assert.equal((await handler(request())).status, 502);
  }
  assert.equal(blueprintSchema.safeParse(result.blueprint).success, true);
});
for (const provider of ["gemini", "groq"] as const) {
  test(`${provider} SDK uses locked model and structured JSON in exactly one mocked HTTP call`, async () => {
    let calls = 0; let body: Record<string, unknown> = {}; let url = "";
    const transport: typeof fetch = async (input, init) => {
      calls++; const req = new Request(input, init); url = req.url; body = await req.json();
      return Response.json(provider === "groq" ? { id: "mock", usage: { prompt_tokens: 42, completion_tokens: 18, total_tokens: 60 }, choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(result.blueprint) } }] } : { usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 18, totalTokenCount: 60 }, candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify(result.blueprint) }] } }] });
    };
    const output = await createGenerator(transport)(answers, { provider, key: "test-not-real", model: models[provider] }, new AbortController().signal);
    assert.equal(calls, 1); assert.deepEqual(JSON.parse(output.text), result.blueprint);
    assert.deepEqual(output.usage, { inputTokens: 42, outputTokens: 18, totalTokens: 60 });
    if (provider === "groq") { assert.equal(body.model, models.groq); assert.equal((body.response_format as { type: string }).type, "json_schema"); }
    else { assert.match(url, /gemini-2\.5-flash-lite/); assert.equal((body.generationConfig as { responseMimeType: string }).responseMimeType, "application/json"); }
  });
  test(`${provider} SDK performs no hidden retry or fallback on mocked 429`, async () => {
    let calls = 0;
    const transport: typeof fetch = async () => { calls++; return Response.json({ error: { code: 429, message: "Mock quota", type: "rate_limit_error" } }, { status: 429 }); };
    await assert.rejects(createGenerator(transport)(answers, { provider, key: "test-not-real", model: models[provider] }, new AbortController().signal));
    assert.equal(calls, 1);
  });
}

test("Gemini continuation is explicitly disabled to prevent an extra generation request", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return Response.json({ candidates: [{ finishReason: "CONTINUATION", continuationToken: "mock-continuation", content: { role: "model", parts: [{ text: "partial" }] } }] }); };
  await assert.rejects(createGenerator(transport)(answers, { provider: "gemini", key: "test-not-real", model: models.gemini }, new AbortController().signal), /incomplete/);
  assert.equal(calls, 1);
});
