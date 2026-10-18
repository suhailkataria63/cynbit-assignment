import { z } from "zod";

// Structural validation stays strict: required objects/fields, types, nonblank
// required text and the core architecture/roadmap. Length, style and suggested
// list sizes belong to presentation; the overall response byte limit stays fixed.
const text = z.string().trim().min(1);
const items = z.array(text);
const roadmapPhase = z.strictObject({ phase: text, activities: items.optional(), deliverables: items.min(1), exitCriteria: text });
const kpi = z.strictObject({ metric: text, measurement: text, target: text, baseline: text.nullable().optional(), targetSource: z.enum(["user-provided", "AI-proposed", "unspecified", "needs-clarification"]).optional() });
const architectureStep = z.strictObject({
  title: text,
  purpose: text,
  input: text.nullable(),
  process: text,
  output: text.nullable(),
  technology: items,
});
const architectureFields = { overview: text, dataFlow: items.min(1) };
const stepDetails = z.array(architectureStep);
export const blueprintSchema = z.strictObject({
  executiveSummary: text,
  userSuccessCriteria: text.optional(),
  analysis: z.strictObject({ problem: text, requirements: items }),
  solution: z.strictObject({ proposal: text, justification: text }),
  feasibility: z.strictObject({ recommendation: z.enum(["AI-assisted", "Non-AI", "Further discovery needed"]), rationale: text, dataReadiness: text }),
  techStack: z.array(z.strictObject({ component: text, technology: text, rationale: text })),
  architecture: z.strictObject({ ...architectureFields, stepDetails: stepDetails.optional() }),
  roadmap: z.array(roadmapPhase).min(1),
  risks: items, assumptions: items, missingInformation: items, limitations: items,
  benefits: items,
  kpis: z.array(kpi),
  nextSteps: items,
});
// New generations require the extra fields; existing caches remain compatible.
// Flow summaries and detailed steps can describe different levels of granularity.
export const generationBlueprintSchema = blueprintSchema.omit({ userSuccessCriteria: true }).extend({
  architecture: z.strictObject({ ...architectureFields, stepDetails }),
  roadmap: z.array(roadmapPhase.extend({ activities: items })).min(1),
  kpis: z.array(kpi.extend({ baseline: text.nullable(), targetSource: z.enum(["user-provided", "AI-proposed", "unspecified", "needs-clarification"]) })),
});
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const tokenUsageSchema = z.strictObject({ inputTokens: count, outputTokens: count, totalTokens: count });
export const generationUsageSchema = tokenUsageSchema.extend({
  durationMs: z.number().finite().nonnegative().nullable(),
  requestedAt: z.iso.datetime().nullable(),
  status: z.enum(["success", "failure"]),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type GenerationUsage = z.infer<typeof generationUsageSchema>;
export const generationDetailsSchema = z.strictObject({
  provider: z.enum(["groq", "gemini"]), model: z.enum(["openai/gpt-oss-120b", "gemini-2.5-flash-lite"]), usage: generationUsageSchema,
});
export type GenerationDetails = z.infer<typeof generationDetailsSchema>;
export type Blueprint = z.infer<typeof blueprintSchema>;
export const metadataSchema = z.union([
  z.strictObject({ provider: z.literal("groq"), model: z.literal("openai/gpt-oss-120b"), generatedAt: z.iso.datetime(), usage: generationUsageSchema.optional() }),
  z.strictObject({ provider: z.literal("gemini"), model: z.literal("gemini-2.5-flash-lite"), generatedAt: z.iso.datetime(), usage: generationUsageSchema.optional() }),
]);
export const blueprintResultSchema = z.strictObject({ blueprint: blueprintSchema, metadata: metadataSchema });
export type BlueprintResult = z.infer<typeof blueprintResultSchema>;

// Use only common structured-output keywords at the provider boundary. Zod
// enforces required/nonblank content and core structure after the response arrives.
function structuralSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["$schema", "minLength", "maxLength", "minItems", "maxItems"].includes(key)).map(([key, child]) => [key, structuralSchema(child)]));
}
export const blueprintJsonSchema = structuralSchema(z.toJSONSchema(generationBlueprintSchema)) as Record<string, unknown>;
export const MAX_INPUT_BYTES = 32_768;
export const MAX_OUTPUT_BYTES = 65_536;
export const OUTPUT_TOKENS = 12_000;
