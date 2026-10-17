import { blueprintResultSchema, generationDetailsSchema, MAX_INPUT_BYTES } from "../blueprint/schema";
import { normalizeAnswers, questionnaireSchema } from "./questionnaire";
import { readSession, reserveAttempt, saveSession, type DiscoverySession, type StorageLike } from "./storage";

export class CacheSaveError extends Error {
  constructor(public session: DiscoverySession) { super("Your blueprint was generated, but the browser could not save it. Keep this tab open and copy or export it before leaving."); }
}

export class GenerationRequestError extends Error {
  constructor(message: string, public session: DiscoverySession) { super(message); }
}

// One explicit invocation, one fetch. No effects, retry libraries, or fallback.
// The caller holds an origin-wide Web Lock as well as its synchronous click guard.
export async function generateBlueprint(session: DiscoverySession, storage: StorageLike, transport: typeof fetch = fetch, signal?: AbortSignal) {
  if (session.result) return session;
  const persisted = readSession(storage);
  if (persisted && persisted.id !== session.id) throw new Error("Another tab started a discovery. Reload to use the current saved session.");
  if (persisted?.result) return { ...persisted, view: "results" as const };
  const answers = questionnaireSchema.parse(normalizeAnswers(session.answers));
  const body = JSON.stringify({ sessionId: session.id, answers });
  if (new TextEncoder().encode(body).byteLength > MAX_INPUT_BYTES) throw new Error("The questionnaire is too large. Shorten some answers and try again.");
  saveSession(storage, session);
  reserveAttempt(storage);
  const response = await transport("/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
  if (!response.ok) {
    // Only display our own route's public error contract, never arbitrary HTML.
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error.slice(0, 500) : "Blueprint generation failed. Your answers are saved; no automatic retry was made.";
    const parsedDetails = generationDetailsSchema.safeParse(payload && typeof payload === "object" && "generationDetails" in payload ? payload.generationDetails : null);
    if (parsedDetails.success) {
      const failed = { ...session, lastGeneration: parsedDetails.data };
      try { saveSession(storage, failed); } catch { /* Retain safe metadata in memory if storage is full. */ }
      throw new GenerationRequestError(message, failed);
    }
    throw new Error(message);
  }
  const result = blueprintResultSchema.parse(await response.json());
  const completed: DiscoverySession = { ...session, answers, step: 3, result, lastGeneration: result.metadata.usage ? { provider: result.metadata.provider, model: result.metadata.model, usage: result.metadata.usage } : undefined, view: "results" };
  // Cache is committed before results are shown. A subsequent click/reload uses
  // the persisted result and cannot trigger another successful generation.
  try { saveSession(storage, completed); } catch { throw new CacheSaveError(completed); }
  return completed;
}
