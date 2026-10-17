import { test } from "node:test";
import assert from "node:assert/strict";
import { generationFailureLog } from "../../src/lib/blueprint/diagnostics";
import type { GenerationDetails } from "../../src/lib/blueprint/schema";
import { blueprintJsonSchema, generationBlueprintSchema } from "../../src/lib/blueprint/schema";
import { normalizeAnswers, questionnaireSchema } from "../../src/lib/discovery/questionnaire";
import { answers } from "../fixtures";

const details: GenerationDetails = { provider: "groq", model: "openai/gpt-oss-120b", usage: { inputTokens: null, outputTokens: null, totalTokens: null, durationMs: 5500, requestedAt: null, status: "failure" } };

test("failure diagnostics retain status, fixed classification, duration and request ID without raw provider data", () => {
  const diagnostic = generationFailureLog({ status: 400, error: { code: "json_validate_failed", message: "private questionnaire / gsk_secret", failed_generation: "private generated content" }, headers: new Headers({ "x-request-id": "req_0123456789", authorization: "Bearer private-token" }) }, details);
  assert.deepEqual(diagnostic, { provider: "groq", model: "openai/gpt-oss-120b", httpStatus: 400, code: "json_validate_failed", message: "Provider could not produce the required JSON output.", durationMs: 5500, requestId: "req_0123456789" });
  assert.doesNotMatch(JSON.stringify(diagnostic), /private|gsk_secret|Bearer|questionnaire|generated content/);
  const arbitrary = generationFailureLog({ status: 400, error: { code: "gsk_secret", message: "private information" }, headers: new Headers({ "x-request-id": "gsk_secret" }) }, details);
  assert.equal(arbitrary.code, "provider_error"); assert.equal(arbitrary.requestId, null);
  assert.doesNotMatch(JSON.stringify(arbitrary), /secret|private/);
  assert.equal(generationFailureLog({ status: 400, error: { message: "temperature unsupported; private questionnaire" } }, details).message, "Provider rejected the generation request; inspect temperature.");
  assert.equal(generationFailureLog({ status: 429, message: "confidential" }, details).httpStatus, 429);
  assert.equal(generationFailureLog(new Error("confidential"), details).httpStatus, null);
});

test("Groq strict schema keeps every object closed and every property required, including nullable KPI baselines", () => {
  const inspect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(inspect); return; }
    const schema = node as Record<string, unknown>;
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...(schema.required as string[])].sort(), Object.keys(schema.properties as object).sort());
    }
    Object.values(schema).forEach(inspect);
  };
  inspect(blueprintJsonSchema);
  assert.equal(generationBlueprintSchema.safeParse({}).success, false);
});

test("free-text INR budgets survive normalization verbatim; blank budgets stay unspecified", () => {
  for (const amount of ["500000", "500000-800000", "5 lakh", "10-15 lakh"]) {
    const normalized = normalizeAnswers({ ...answers, budget: amount, budgetCurrency: "INR" });
    assert.equal(normalized.budget, `INR ${amount}`);
    assert.equal(questionnaireSchema.parse(normalized).budget, `INR ${amount}`);
  }
  for (const budget of ["", " ", "INR "]) assert.equal(normalizeAnswers({ ...answers, budget, budgetCurrency: "INR" }).budget, "");
});
