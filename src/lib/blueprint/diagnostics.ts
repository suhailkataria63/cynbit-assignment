import type { GenerationDetails } from "./schema";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const knownCodes = new Set(["json_validate_failed", "schema_validation_failed", "invalid_json_schema", "invalid_request_error", "rate_limit_exceeded", "rate_limit_error", "invalid_api_key", "authentication_error", "model_not_found", "context_length_exceeded"]);

// Provider messages can echo prompts, generated content, or credentials. Classify
// them into fixed messages; never log the raw SDK error, body, message, or headers.
export function generationFailureLog(error: unknown, details: GenerationDetails) {
  const outer = record(error);
  const body = record(outer.error);
  const nested = Object.keys(record(body.error)).length ? record(body.error) : body;
  const status = Number(outer.status);
  const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
  const rawCode = nested.code ?? nested.type;
  const code = typeof rawCode === "string" && knownCodes.has(rawCode) ? rawCode : "provider_error";
  const rawMessage = typeof nested.message === "string" ? nested.message : typeof outer.message === "string" ? outer.message : "";
  const parameter = ["response_format", "json_schema", "reasoning_effort", "reasoning_format", "include_reasoning", "temperature", "max_completion_tokens", "max_tokens", "messages"].find(name => rawMessage.includes(name));
  const message = code === "json_validate_failed" ? "Provider could not produce the required JSON output."
    : /schema/i.test(code) || /json_schema|json schema|schema validation/i.test(rawMessage) ? "Provider rejected the structured-output schema."
    : httpStatus === 429 ? "Provider quota or rate limit reached."
    : httpStatus === 401 || httpStatus === 403 ? "Provider authentication or permissions rejected."
    : httpStatus === 400 || httpStatus === 422 ? parameter ? `Provider rejected the generation request; inspect ${parameter}.` : "Provider rejected the generation request."
    : httpStatus === 504 || /timeout|timed out|cancelled/i.test(rawMessage) ? "Generation timed out or was cancelled."
    : "Generation failed or returned an invalid or incomplete blueprint.";
  let requestId: string | null = null;
  const headers = outer.headers;
  const candidate = headers instanceof Headers ? headers.get("x-request-id") ?? headers.get("request-id") : outer.request_id;
  // Only recognized request-ID shapes; arbitrary header/body values stay private.
  if (typeof candidate === "string" && /^(?:req_[A-Za-z0-9_-]{6,96}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(candidate)) requestId = candidate;
  return { provider: details.provider, model: details.model, httpStatus, code, message, durationMs: details.usage.durationMs, requestId };
}
