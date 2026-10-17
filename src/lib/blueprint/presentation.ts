import type { Blueprint, BlueprintResult } from "./schema";

export function cleanGroupItem(value: string, group: "risk" | "assumption" | "missing information" | "limitation" | "benefit") {
  // Remove only a known redundant leading label; never split or summarize prose.
  const prefix = group === "benefit" ? "(?:(?:expected|proposed)\\s+)?benefits?" : `${group}s?`;
  return value.replace(new RegExp(`^(?:\\s*${prefix}\\s*:\\s*)+`, "i"), "").trim() || value;
}
export function riskGroups(blueprint: Blueprint) {
  return [
    { title: "Risks", items: blueprint.risks.map(item => cleanGroupItem(item, "risk")) },
    { title: "Assumptions", items: blueprint.assumptions.map(item => cleanGroupItem(item, "assumption")) },
    { title: "Missing Information", items: blueprint.missingInformation.map(item => cleanGroupItem(item, "missing information")) },
    { title: "Limitations", items: blueprint.limitations.map(item => cleanGroupItem(item, "limitation")) },
  ];
}
export function targetSourceLabel(source: Blueprint["kpis"][number]["targetSource"]) {
  return source === "needs-clarification" ? "Needs clarification" : source === "user-provided" ? "User-provided goal" : source === "AI-proposed" ? "AI recommendation" : source === "unspecified" ? "Target to be agreed" : "Source not recorded";
}

export function blueprintSections({ blueprint: b }: BlueprintResult) {
  return [
    { id: "summary", title: "Executive summary", lines: [b.executiveSummary] },
    { id: "analysis", title: "Problem & requirements analysis", lines: [b.analysis.problem, ...b.analysis.requirements] },
    { id: "solution", title: "Proposed solution & justification", lines: [b.solution.proposal, b.solution.justification] },
    { id: "feasibility", title: "AI / ML feasibility", lines: [b.feasibility.recommendation, b.feasibility.rationale, `Data readiness: ${b.feasibility.dataReadiness}`] },
    { id: "technology", title: "Technology stack", lines: b.techStack.map(item => `${item.component} — ${item.technology}: ${item.rationale}`) },
    { id: "architecture", title: "Architecture & data flow", lines: [b.architecture.overview, ...b.architecture.dataFlow.map((item, i) => `${i + 1}. ${item}`)] },
    { id: "roadmap", title: "Phased implementation roadmap", lines: b.roadmap.map(item => `${item.phase}\n${item.activities ? `Activities:\n${item.activities.map(value => `• ${value}`).join("\n")}\n` : ""}Deliverables:\n${item.deliverables.map(value => `• ${value}`).join("\n")}\nExit criteria: ${item.exitCriteria}`) },
    { id: "risks", title: "Risks, assumptions & limitations", lines: [...b.risks.map(item => `Risk: ${item}`), ...b.assumptions.map(item => `Assumption: ${item}`), ...b.missingInformation.map(item => `Missing information: ${item}`), ...b.limitations.map(item => `Limitation: ${item}`)] },
    { id: "benefits", title: "Benefits & measurable KPIs", lines: [...(b.userSuccessCriteria ? [`User-provided success criteria: ${b.userSuccessCriteria}`] : []), ...b.benefits.map(item => `Expected benefit: ${cleanGroupItem(item, "benefit")}`), ...b.kpis.map(item => `${item.metric}\nCurrent baseline: ${item.baseline ?? "Not provided"}\nTarget source: ${targetSourceLabel(item.targetSource)}\nMeasurement: ${item.measurement}\nTarget: ${item.target}`)] },
    { id: "next-steps", title: "Next steps", lines: b.nextSteps },
  ];
}
export function blueprintText(result: BlueprintResult) {
  const usage = result.metadata.usage;
  const count = (value: number | null | undefined) => value == null ? "Unavailable" : String(value);
  const details = `Input tokens: ${count(usage?.inputTokens)}\nOutput tokens: ${count(usage?.outputTokens)}\nTotal tokens: ${count(usage?.totalTokens)}\nGeneration duration (ms): ${count(usage?.durationMs)}\nRequest timestamp: ${usage?.requestedAt ?? "Unavailable"}\nStatus: ${usage?.status ?? "Unavailable"}`;
  return `Cynbit — Solution Blueprint\nProvider: ${result.metadata.provider}\nModel: ${result.metadata.model}\nGenerated: ${result.metadata.generatedAt}\n${details}\n\nAI-generated guidance. Validate assumptions, architecture, and estimates with your team.\n\n` + blueprintSections(result).map(section => `${section.title}\n${section.lines.join("\n\n")}`).join("\n\n");
}
