import { z } from "zod";

const paragraph = z.string().trim().min(1).max(2000);
const items = z.array(z.string().trim().min(1).max(600)).min(1).max(8);
const roadmapPhase = z.strictObject({ phase: z.string().min(1).max(150), activities: items.optional(), deliverables: items, exitCriteria: z.string().min(1).max(600) });
const kpi = z.strictObject({ metric: z.string().min(1).max(150), measurement: z.string().min(1).max(600), target: z.string().min(1).max(300), baseline: z.string().trim().min(1).max(300).nullable().optional(), targetSource: z.enum(["user-provided", "AI-proposed", "unspecified", "needs-clarification"]).optional() });
export const blueprintSchema = z.strictObject({
  executiveSummary: paragraph,
  userSuccessCriteria: z.string().trim().min(1).max(2000).optional(),
  analysis: z.strictObject({ problem: paragraph, requirements: items }),
  solution: z.strictObject({ proposal: paragraph, justification: paragraph }),
  feasibility: z.strictObject({ recommendation: z.enum(["AI-assisted", "Non-AI", "Further discovery needed"]), rationale: paragraph, dataReadiness: paragraph }),
  techStack: z.array(z.strictObject({ component: z.string().min(1).max(150), technology: z.string().min(1).max(150), rationale: z.string().min(1).max(600) })).min(1).max(8),
  architecture: z.strictObject({ overview: paragraph, dataFlow: items }),
  roadmap: z.array(roadmapPhase).min(1).max(5),
  risks: items, assumptions: items, missingInformation: items, limitations: items,
  benefits: items,
  kpis: z.array(kpi).min(1).max(6),
  nextSteps: items,
});
// New generations require the extra structure; existing cache entries do not.
export const generationBlueprintSchema = blueprintSchema.omit({ userSuccessCriteria: true }).extend({
  roadmap: z.array(roadmapPhase.extend({ activities: items })).min(1).max(5),
  kpis: z.array(kpi.extend({ baseline: z.string().trim().min(1).max(300).nullable(), targetSource: z.enum(["user-provided", "AI-proposed", "unspecified", "needs-clarification"]) })).min(1).max(6),
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
// enforces string/array size constraints again after the response arrives.
function structuralSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["$schema", "minLength", "maxLength", "minItems", "maxItems"].includes(key)).map(([key, child]) => [key, structuralSchema(child)]));
}
export const blueprintJsonSchema = structuralSchema(z.toJSONSchema(generationBlueprintSchema)) as Record<string, unknown>;
export const MAX_INPUT_BYTES = 32_768;
export const MAX_OUTPUT_BYTES = 65_536;
export const OUTPUT_TOKENS = 12_000;
