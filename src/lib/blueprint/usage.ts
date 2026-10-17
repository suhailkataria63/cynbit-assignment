import type { TokenUsage } from "./schema";

export const unavailableTokens: TokenUsage = { inputTokens: null, outputTokens: null, totalTokens: null };
function reportedCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
// Read the existing response only. Never count tokens or derive a missing total.
export function groqTokenUsage(value: unknown): TokenUsage {
  const usage = record(value);
  return { inputTokens: reportedCount(usage.prompt_tokens), outputTokens: reportedCount(usage.completion_tokens), totalTokens: reportedCount(usage.total_tokens) };
}
export function geminiTokenUsage(value: unknown): TokenUsage {
  const usage = record(value);
  return { inputTokens: reportedCount(usage.promptTokenCount), outputTokens: reportedCount(usage.candidatesTokenCount), totalTokens: reportedCount(usage.totalTokenCount) };
}
