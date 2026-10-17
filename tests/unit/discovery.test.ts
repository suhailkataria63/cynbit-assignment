import { test } from "node:test";
import assert from "node:assert/strict";
import { answers, result } from "../fixtures";
import { currencies, parseBudget, serializeBudget } from "../../src/lib/discovery/budget";
import { draftSchema, emptyAnswers, normalizeAnswers, questionnaireSchema, validateStep } from "../../src/lib/discovery/questionnaire";
import { BUDGET_KEY, freshSession, readBudget, readSession, reserveAttempt, saveSession, type StorageLike } from "../../src/lib/discovery/storage";
import { CacheSaveError, generateBlueprint } from "../../src/lib/discovery/generate";
import { blueprintSections, blueprintText } from "../../src/lib/blueprint/presentation";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
test("exactly eight primary fields are required, with stage-specific validation", () => {
  const parsed = questionnaireSchema.safeParse(emptyAnswers);
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.deepEqual(parsed.error.issues.map(i => i.path[0]).sort(), ["industry", "description", "problem", "workflow", "challenges", "users", "goals", "success"].sort());
  assert.deepEqual(Object.keys(validateStep(emptyAnswers, 0)).sort(), ["description", "industry"]);
  assert.deepEqual(validateStep(answers, 0), {});
  assert.equal(questionnaireSchema.safeParse(answers).success, true);
});
test("Other details, optional numbers, and mutually exclusive data validate deterministically", () => {
  assert.equal(questionnaireSchema.safeParse({ ...answers, industry: "Other" }).success, false);
  assert.equal(questionnaireSchema.safeParse({ ...answers, goals: ["Other"] }).success, false);
  assert.equal(questionnaireSchema.safeParse({ ...answers, challenges: ["Other"] }).success, false);
  assert.equal(questionnaireSchema.safeParse({ ...answers, supportVolume: "-1" }).success, false);
  assert.equal(questionnaireSchema.safeParse({ ...answers, data: ["Unsure", "Spreadsheets"] }).success, false);
  assert.equal(draftSchema.safeParse({ ...answers, supportVolume: "0." }).success, true);
  const normalized = normalizeAnswers({ ...answers, focus: "Recruitment", monthlyApplications: "30", goalsOther: "hidden", integrationDetails: "hidden" });
  assert.equal(normalized.supportVolume, ""); assert.equal(normalized.monthlyApplications, "30");
  assert.equal(normalized.goalsOther, ""); assert.equal(normalized.integrationDetails, "");
});
test("draft, step, and cached result persist; new discovery does not reset the budget", () => {
  const storage = new MemoryStorage();
  const session = { ...freshSession(), answers, step: 2, result, view: "results" as const };
  saveSession(storage, session);
  assert.deepEqual(readSession(storage), session);
  reserveAttempt(storage);
  const next = freshSession(); saveSession(storage, next);
  assert.notEqual(next.id, session.id); assert.equal(readSession(storage)?.result, null);
  assert.equal(readBudget(storage), 1);
});
test("12-attempt budget counts failures, blocks 13th, rolls over daily, and fails closed on corruption", () => {
  const storage = new MemoryStorage(); const date = new Date(2026, 9, 17);
  for (let i = 0; i < 12; i++) reserveAttempt(storage, date, 12);
  assert.throws(() => reserveAttempt(storage, date, 12), /used up/);
  assert.equal(readBudget(storage, new Date(2026, 9, 18)), 0);
  storage.setItem(BUDGET_KEY, "broken"); assert.throws(() => reserveAttempt(storage));
});
test("generation makes one request; revisit uses cache; failures preserve answers and count attempts", async () => {
  const storage = new MemoryStorage(); const session = { ...freshSession(), answers, step: 3 };
  let calls = 0;
  const fetchMock: typeof fetch = async () => { calls++; return Response.json(result); };
  const completed = await generateBlueprint(session, storage, fetchMock);
  assert.equal(calls, 1); assert.equal(readBudget(storage), 1); assert.equal(completed.view, "results");
  await generateBlueprint(session, storage, fetchMock);
  await generateBlueprint(completed, storage, fetchMock);
  assert.equal(calls, 1);
  const next = { ...freshSession(), answers, step: 3 }; saveSession(storage, next);
  await assert.rejects(generateBlueprint(next, storage, async () => { calls++; return Response.json({ error: "Quota reached" }, { status: 429 }); }), /Quota reached/);
  assert.equal(calls, 2); assert.equal(readBudget(storage), 2); assert.deepEqual(readSession(storage)?.answers, answers);
});
test("invalid answers never call API; unavailable result cache keeps a successful in-memory result", async () => {
  const storage = new MemoryStorage(); let calls = 0;
  await assert.rejects(generateBlueprint(freshSession(), storage, async () => { calls++; return Response.json(result); }));
  assert.equal(calls, 0);
  const session = { ...freshSession(), answers, step: 3 };
  const original = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { if (value.includes('"executiveSummary"')) throw new Error("storage full"); original(key, value); };
  await assert.rejects(generateBlueprint(session, storage, async () => Response.json(result)), error => error instanceof CacheSaveError && !!error.session.result);
});
test("copy/export presentation covers all ten sections, approved metadata, and assumptions", () => {
  assert.equal(blueprintSections(result).length, 10);
  assert.match(blueprintText(result), /openai\/gpt-oss-120b/);
  assert.match(blueprintText(result), /Assumption:/);
  assert.match(blueprintText(result), /Missing information:/);
});


test("currency budgets default empty, serialize once, and retain currency across storage/navigation", () => {
  assert.equal(emptyAnswers.budget, ""); assert.equal(emptyAnswers.budgetCurrency, "INR");
  assert.equal(currencies.length, 9);
  for (const { code } of currencies) {
    assert.equal(serializeBudget("", code), "");
    assert.equal(serializeBudget("300,000–500,000", code), `${code} 300,000–500,000`);
    assert.equal(serializeBudget(`${code} 300,000–500,000`, code), `${code} 300,000–500,000`);
  }
  assert.equal(serializeBudget("INR 300,000", "USD"), "USD 300,000");
  const storage = new MemoryStorage();
  const session = { ...freshSession(), answers: { ...answers, budget: "300,000–500,000", budgetCurrency: "EUR" as const }, step: 2 };
  saveSession(storage, session);
  assert.equal(readSession(storage)?.answers.budgetCurrency, "EUR");
  assert.equal(normalizeAnswers(session.answers).budget, "EUR 300,000–500,000");
  assert.equal(normalizeAnswers({ ...session.answers, budget: "" }).budget, "");
});
test("legacy budgets remain readable without assigning an unsupported currency or prefilling Not sure", () => {
  for (const value of ["", "Not sure", "USD 5,000", "5,000", "$5,000"]) {
    const legacy = { ...answers, budget: value }; delete legacy.budgetCurrency;
    assert.deepEqual(draftSchema.parse(legacy), legacy);
    const storage = new MemoryStorage(); const session = { ...freshSession(), answers: legacy };
    saveSession(storage, session); assert.deepEqual(readSession(storage)?.answers, legacy);
  }
  assert.equal(parseBudget("Not sure").amount, "");
  assert.deepEqual(parseBudget("USD 5,000"), { currency: "USD", amount: "5,000" });
  assert.deepEqual(parseBudget("$5,000"), { currency: "", amount: "$5,000" });
  assert.equal(serializeBudget("$5,000"), "$5,000");
  assert.equal(serializeBudget("Not sure"), "");
});
