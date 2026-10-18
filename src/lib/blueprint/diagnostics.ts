import type { GenerationDetails } from "./schema";
import { blueprintJsonSchema, OUTPUT_TOKENS } from "./schema";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const knownCodes = new Set(["json_validate_failed", "schema_validation_failed", "invalid_json_schema", "invalid_request_error", "rate_limit_exceeded", "rate_limit_error", "invalid_api_key", "authentication_error", "model_not_found", "context_length_exceeded"]);

export interface CompletionMetadata { finishReason: string | null; truncated: boolean | null }
export function completionMetadata(reason: unknown): CompletionMetadata {
  // Only provider enum values, never arbitrary SDK/body strings.
  const known = new Set(["stop", "length", "content_filter", "tool_calls", "function_call", "STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "MALFORMED_FUNCTION_CALL", "CONTINUATION", "FINISH_REASON_UNSPECIFIED"]);
  const finishReason = typeof reason === "string" && known.has(reason) ? reason : null;
  const truncated = finishReason === "length" || finishReason === "MAX_TOKENS" ? true : finishReason === "stop" || finishReason === "STOP" ? false : null;
  return { finishReason, truncated };
}

interface ValidationIssue { code: string; path: readonly PropertyKey[]; message?: string }
function safeFieldPath(path: readonly PropertyKey[]) {
  let schema: Record<string, unknown> = blueprintJsonSchema;
  let label = "";
  for (const part of path.slice(0, 12)) {
    if (typeof part === "number" && Number.isInteger(part) && part >= 0 && part <= 100_000 && schema.type === "array") {
      label += `[${part}]`; schema = record(schema.items);
    } else if (typeof part === "string" && Object.hasOwn(record(schema.properties), part)) {
      label += `${label ? "." : ""}${part}`; schema = record(record(schema.properties)[part]);
    } else { label += "[unrecognized]"; break; }
  }
  return label || "<root>";
}

export function schemaIssueDiagnostics(issues: readonly ValidationIssue[]) {
  const codes = new Set(["invalid_type", "too_big", "too_small", "invalid_format", "not_multiple_of", "unrecognized_keys", "invalid_union", "invalid_key", "invalid_element", "invalid_value", "custom"]);
  return issues.slice(0, 50).map(issue => {
    const data = record(issue);
    const rule = issue.message === "Provide one detail record per flow step in the same order." ? "step_details_count_mismatch"
      : issue.message === "Explain the step rather than repeating its title or flow label." ? "step_details_duplicate_explanation" : undefined;
    const expected = typeof data.expected === "string" && ["string", "number", "array", "object", "boolean", "null"].includes(data.expected) ? data.expected : undefined;
    const bound = issue.code === "too_big" ? data.maximum : issue.code === "too_small" ? data.minimum : undefined;
    const limit = typeof bound === "number" && Number.isFinite(bound) && bound >= 0 && bound <= 1_000_000 ? bound : undefined;
    // Never include issue.message, input, enum values, unknown keys or raw paths:
    // Zod can embed generated/private content in those properties.
    return { path: safeFieldPath(issue.path), code: codes.has(issue.code) ? issue.code : "validation_error", ...(rule ? { rule } : {}), ...(expected ? { expected } : {}), ...(limit !== undefined ? { limit } : {}) };
  });
}

export interface OutputDiagnostics {
  stage: "provider_response" | "output_size" | "json_parse" | "schema_validation" | "post_validation";
  jsonParsing: "not_attempted" | "failed" | "succeeded";
  completion?: CompletionMetadata;
  responseBytes?: number;
  schemaIssues?: ReturnType<typeof schemaIssueDiagnostics>;
  schemaIssueCount?: number;
}
export function logDevelopmentOutputFailure(details: GenerationDetails, diagnostic: OutputDiagnostics) {
  if (process.env.NODE_ENV !== "development") return;
  // JSON string survives development console serialization (objects may show {}).
  console.error("blueprint_output_diagnostics", JSON.stringify({
    provider: details.provider, model: details.model, stage: diagnostic.stage,
    jsonParsing: diagnostic.jsonParsing, finishReason: diagnostic.completion?.finishReason ?? null,
    truncated: diagnostic.completion?.truncated ?? null,
    responseBytes: diagnostic.responseBytes ?? null, outputTokenLimit: OUTPUT_TOKENS,
    outputTokens: details.usage.outputTokens, schemaIssues: diagnostic.schemaIssues ?? [],
    schemaIssueCount: diagnostic.schemaIssueCount ?? 0,
  }));
}

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
