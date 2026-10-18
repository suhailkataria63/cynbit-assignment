import { z } from "zod";
import { normalizeAnswers, questionnaireSchema } from "../discovery/questionnaire";
import { generationBlueprintSchema, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, type BlueprintResult, type GenerationDetails } from "./schema";
import { generationFailureLog, logDevelopmentOutputFailure, schemaIssueDiagnostics, type OutputDiagnostics } from "./diagnostics";
import { groundKpis } from "./grounding";
import { unavailableTokens } from "./usage";
import { models, BlueprintError, createGenerator, providerConfig, TIMEOUT_MS, type Generate, type ProviderConfig } from "./providers";

const requestSchema = z.strictObject({ sessionId: z.uuid(), answers: questionnaireSchema });
const DAY = 86_400_000;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function dailyLimit() {
  const value = Number(process.env.BLUEPRINT_SERVER_DAILY_LIMIT ?? 12);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : 12;
}
async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new BlueprintError(415, "Send an application/json request.");
  if (Number(request.headers.get("content-length")) > MAX_INPUT_BYTES) throw new BlueprintError(413, "The questionnaire is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new BlueprintError(400, "A questionnaire is required.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INPUT_BYTES) { void reader.cancel(); throw new BlueprintError(413, "The questionnaire is too large."); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new BlueprintError(400, "The request must contain valid JSON."); }
  };
  try {
    return await Promise.race([read(), new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new BlueprintError(408, "The request body took too long to arrive.")); void reader.cancel(); }, 5000);
    })]);
  } finally { clearTimeout(timer); }
}

interface Dependencies { generate?: Generate; getConfig?: () => ProviderConfig; now?: () => number; timeoutMs?: number; limit?: number }
export function createBlueprintHandler({ generate = createGenerator(), getConfig = providerConfig, now = Date.now, timeoutMs = TIMEOUT_MS, limit = dailyLimit() }: Dependencies = {}) {
  // Per-process only. Global rather than spoofable IP-based limits, since this
  // unauthenticated PoC has no trusted proxy configuration or user identity.
  let day = -1;
  let attempts = 0;
  let recent: number[] = [];
  const completed = new Map<string, { result: BlueprintResult; expires: number }>();
  const pending = new Set<string>();
  return async function POST(request: Request): Promise<Response> {
    let details: GenerationDetails | undefined;
    const diagnostic: OutputDiagnostics = { stage: "provider_response", jsonParsing: "not_attempted" };
    let started = 0;
    try {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new BlueprintError(403, "Cross-origin requests are not supported.");
      const input = requestSchema.safeParse(await readBody(request));
      if (!input.success) throw new BlueprintError(400, "Please complete the required fields and check the questionnaire values.");
      const { sessionId } = input.data;
      const stamp = now();
      for (const [id, cached] of completed) if (cached.expires <= stamp) completed.delete(id);
      const cached = completed.get(sessionId);
      if (cached) return Response.json(cached.result, { headers });
      if (pending.has(sessionId)) throw new BlueprintError(409, "This discovery is already generating a blueprint. No second request was made.");
      const config = getConfig();
      if (Math.floor(stamp / DAY) !== day) { day = Math.floor(stamp / DAY); attempts = 0; }
      recent = recent.filter(time => stamp - time < 60_000);
      if (attempts >= limit || recent.length >= 3 || pending.size >= 2) throw new BlueprintError(429, "The server’s testing limit has been reached. Your answers are saved; try again later.");
      attempts++; recent.push(stamp); pending.add(sessionId);
      started = performance.now();
      details = { provider: config.provider, model: models[config.provider], usage: { ...unavailableTokens, requestedAt: new Date(now()).toISOString(), durationMs: null, status: "failure" } };
      const controller = new AbortController();
      const cancel = () => controller.abort();
      request.signal.addEventListener("abort", cancel, { once: true });
      if (request.signal.aborted) controller.abort();
      const timeout = setTimeout(cancel, timeoutMs);
      let abortListener: (() => void) | undefined;
      try {
        if (controller.signal.aborted) throw new BlueprintError(504, "Generation was cancelled. Your answers are preserved.");
        const response = await Promise.race([
          generate(normalizeAnswers(input.data.answers), config, controller.signal),
          new Promise<never>((_, reject) => {
            abortListener = () => reject(new BlueprintError(504, "Generation timed out or was cancelled. No automatic retry was made; your answers are preserved."));
            controller.signal.addEventListener("abort", abortListener, { once: true });
          }),
        ]);
        details.usage = { ...details.usage, ...response.usage };
        diagnostic.completion = response.completion;
        const raw = response.text;
        diagnostic.stage = "output_size";
        diagnostic.responseBytes = Buffer.byteLength(raw, "utf8");
        if (diagnostic.responseBytes > MAX_OUTPUT_BYTES) throw new BlueprintError(502, "The provider response exceeded the output limit. No automatic retry was made.");
        let json: unknown;
        diagnostic.stage = "json_parse";
        try { json = JSON.parse(raw); diagnostic.jsonParsing = "succeeded"; } catch { diagnostic.jsonParsing = "failed"; throw new BlueprintError(502, "The provider did not return a complete JSON blueprint. No automatic retry was made."); }
        diagnostic.stage = "schema_validation";
        const parsed = generationBlueprintSchema.safeParse(json);
        if (!parsed.success) {
          if (process.env.NODE_ENV === "development") { diagnostic.schemaIssues = schemaIssueDiagnostics(parsed.error.issues); diagnostic.schemaIssueCount = parsed.error.issues.length; }
          throw new BlueprintError(502, "The provider returned an invalid or incomplete blueprint. No automatic retry was made.");
        }
        diagnostic.stage = "post_validation";
        details.usage.durationMs = Math.max(0, Math.round(performance.now() - started));
        details.usage.status = "success";
        const generatedAt = new Date(now()).toISOString();
        const metadata: BlueprintResult["metadata"] = config.provider === "groq"
          ? { provider: "groq", model: "openai/gpt-oss-120b", generatedAt, usage: details.usage }
          : { provider: "gemini", model: "gemini-2.5-flash-lite", generatedAt, usage: details.usage };
        const result = { blueprint: groundKpis(parsed.data, input.data.answers), metadata };
        if (completed.size >= 128) completed.delete(completed.keys().next().value!);
        completed.set(sessionId, { result, expires: now() + DAY });
        return Response.json(result, { headers });
      } finally {
        clearTimeout(timeout); request.signal.removeEventListener("abort", cancel);
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
        pending.delete(sessionId);
      }
    } catch (error) {
      if (details) {
        if (error instanceof BlueprintError && error.usage) details.usage = { ...details.usage, ...error.usage };
        details.usage.durationMs = Math.max(0, Math.round(performance.now() - started));
        details.usage.status = "failure";
        if (error instanceof BlueprintError && error.completion) diagnostic.completion = error.completion;
        logDevelopmentOutputFailure(details, diagnostic);
        console.error("blueprint_generation_failed", generationFailureLog(error, details));
      }
      const status = error instanceof BlueprintError ? error.status : typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
      const message = error instanceof BlueprintError ? error.message : status === 429
        ? "The AI provider’s quota or rate limit was reached. No automatic retry was made. Your answers are preserved."
        : status === 400 || status === 422
        ? "The AI provider rejected this generation request. Ask the project owner to check server diagnostics. Your answers are preserved."
        : "Blueprint generation failed. Check provider availability or ask the project owner to check setup. No automatic retry was made.";
      return Response.json({ error: message, ...(details ? { generationDetails: details } : {}) }, { status: error instanceof BlueprintError ? error.status : status === 429 ? 429 : 502, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
    }
  };
}
