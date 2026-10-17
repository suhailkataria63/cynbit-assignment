import type { BlueprintResult, GenerationUsage } from "@/lib/blueprint/schema";

interface Props { details: Pick<BlueprintResult["metadata"], "provider" | "model"> & { usage?: GenerationUsage } }
export function GenerationDetails({ details }: Props) {
  const { usage } = details;
  const count = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString();
  const fields = [
    ["Provider", details.provider === "groq" ? "Groq" : "Gemini"],
    ["Model", details.model],
    ["Input Tokens", count(usage?.inputTokens)],
    ["Output Tokens", count(usage?.outputTokens)],
    ["Total Tokens", count(usage?.totalTokens)],
    ["Generation Time", usage?.durationMs == null ? "Unavailable" : `${(usage.durationMs / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} seconds`],
    ["Request Timestamp", usage?.requestedAt ? new Date(usage.requestedAt).toLocaleString() : "Unavailable"],
    ["Status", usage?.status === "success" ? "Success" : usage?.status === "failure" ? "Failure" : "Unavailable"],
  ];
  return <section aria-label="Generation Details" className="mb-6 rounded-2xl border border-border bg-surface p-5">
    <h2 className="mb-4 font-sans text-sm font-semibold tracking-normal">Generation Details</h2>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-xs sm:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted">{label}</dt><dd className="mt-1 break-words font-medium tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
    <p className="mt-4 text-[10px] leading-relaxed text-muted">{usage ? "Tokens are reported by the provider for this request; missing counts are unavailable. Duration is measured by this server." : "This saved blueprint has no recorded usage metadata. No request is made to retrieve it."} Browser testing attempts are tracked separately; provider quota and monetary charges are not known.</p>
  </section>;
}
