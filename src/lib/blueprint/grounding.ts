import type { Blueprint } from "./schema";
import type { Questionnaire } from "../discovery/questionnaire";

// Conservative provenance check for new generations only. A model's assertion
// that a value came from the user is not evidence that the user supplied it.
export function groundKpis(blueprint: Blueprint, answers: Questionnaire): Blueprint {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const supplied = Object.values(answers).flatMap(value => Array.isArray(value) ? value : typeof value === "string" ? [value] : []).map(normalize).filter(Boolean);
  const recorded = (value: string) => supplied.some(answer => answer.includes(normalize(value)));
  return { ...blueprint, userSuccessCriteria: answers.success.trim(), kpis: blueprint.kpis.map(kpi => ({
    ...kpi,
    baseline: kpi.baseline && recorded(kpi.baseline) ? kpi.baseline : null,
    targetSource: kpi.targetSource === "unspecified" || (kpi.targetSource === "user-provided" && !recorded(kpi.target)) ? "needs-clarification" : kpi.targetSource,
  })) };
}
