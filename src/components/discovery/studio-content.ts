import type { Blueprint } from "@/lib/blueprint/schema";

// Group supplied roles, not product names or assumed providers. Ambiguous roles
// remain unclassified and every recommendation retains its original wording.
export function groupTechnologies(stack: Blueprint["techStack"]) {
  const categories = [
    ["Security", /\b(security|identity|authentication|authorization|access control|privacy)\b/i],
    ["AI / ML", /\b(ai|ml|llm|machine learning|inference|embedding|model)\b/i],
    ["Data", /\b(data|database|storage|retrieval|search|knowledge|analytics)\b/i],
    ["Application", /\b(application|interface|frontend|backend|web|api|mobile)\b/i],
    ["Infrastructure", /\b(infrastructure|hosting|deployment|monitoring|compute|network|observability)\b/i],
  ] as const;
  const groups = new Map<string, Blueprint["techStack"]>();
  for (const item of stack) {
    const category = categories.find(([, pattern]) => pattern.test(item.component))?.[0] ?? "Other recommendations";
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

// Presentation grouping only. The original ten-section export and JSON stay intact.
export const studioSections = [
  { id: "overview", title: "Overview", items: ["summary", "analysis"] },
  { id: "proposed-solution", title: "Proposed Solution", items: ["solution", "feasibility"] },
  { id: "technical-architecture", title: "Technical Architecture", items: ["technology", "architecture"] },
  { id: "implementation-plan", title: "Implementation Plan", items: ["roadmap", "risks"] },
  { id: "business-outcomes", title: "Business Outcomes", items: ["benefits", "next-steps"] },
] as const;

export function textPreview(text: string, limit = 150) {
  if (text.length <= limit) return text;
  const boundary = text.lastIndexOf(" ", limit);
  return `${text.slice(0, boundary > limit / 2 ? boundary : limit).trimEnd()}…`;
}

// Emphasize only one explicit numerical expression. Never choose between multiple
// goals or interpret numbers/baselines as calculated results. Full wording stays visible.
export function numericTarget(target: string) {
  if (/<[a-z/]|`|https?:/i.test(target)) return null;
  if (/\b(?:not provided|unknown|unsure|to be agreed|clarification|clarify|baseline)\b/i.test(target)) return null;
  const values = [...target.matchAll(/(?:(?:[<>≤≥]=?|~|at least|at most|under|over|less than|more than)\s*)?[+−-]?\d+(?:[.,]\d+)*(?:\s*[–-]\s*\d+(?:[.,]\d+)*)?(?:\s*%|\s+(?:minutes?|hours?|days?|weeks?|months?|seconds?|ms|users?|requests?|applications?|inquiries|tickets?))?/gi)];
  return values.length === 1 ? values[0][0] : null;
}
