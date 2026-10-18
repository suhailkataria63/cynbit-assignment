import type { Blueprint } from "@/lib/blueprint/schema";
import { groupTechnologies, textPreview } from "./studio-content";

const categories = ["Data Sources", "Ingestion", "Storage", "AI/ML Processing", "Application", "Human Review", "Output"] as const;

// Only explicit field labels are extracted from legacy prose. Arrows and nearby
// steps do not establish a step's inputs, purpose or outputs reliably.
function legacyDetails(description: string) {
  const values: Record<string, string> = {};
  const preamble: string[] = [];
  let current: string | undefined;
  let labeled = false;
  for (const line of description.split(/\r?\n/)) {
    const match = /^\s*(?:\*\*)?(Purpose|Inputs?|Process|Outputs?|Technolog(?:y|ies))(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/i.exec(line);
    if (match) {
      labeled = true;
      const label = match[1].toLowerCase();
      current = label === "inputs" ? "input" : label === "outputs" ? "output" : label === "technologies" ? "technology" : label;
      values[current] = [values[current], match[2]].filter(Boolean).join("\n");
    } else if (/^\s*[\w /-]+:/.test(line)) {
      current = undefined;
      if (!labeled) preamble.push(line);
    } else if (current) values[current] += `\n${line}`;
    else if (!labeled) preamble.push(line);
  }
  return { values, title: labeled ? preamble.join("\n").trim() : description.trim(), labeled };
}

function mentions(text: string, name: string) {
  if (!name.trim()) return false;
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export function architectureNodes(architecture: Blueprint["architecture"], stack: Blueprint["techStack"]) {
  const groups = groupTechnologies(stack);
  const aligned = architecture.stepDetails?.length === architecture.dataFlow.length;
  // When granularity differs, the structured records are their own saved
  // sequence. Never zip them onto unrelated flow summaries or discard records.
  // Every original summary remains in the full-description disclosure/exports.
  const steps = architecture.stepDetails?.length && !aligned
    ? architecture.stepDetails.map(supplied => ({ description: supplied.process, supplied, label: supplied.title }))
    : architecture.dataFlow.map((description, index) => ({ description, supplied: aligned ? architecture.stepDetails?.[index] : undefined, label: description }));
  return steps.map(({ description, supplied, label }, index) => {
    const legacy = legacyDetails(description);
    const values = supplied ? { ...supplied, technology: supplied.technology.join(" · ") } : legacy.values;
    const title = supplied?.title || legacy.title;
    const fields = (["purpose", "input", "process", "output", "technology"] as const).flatMap(key => {
      const value = values[key]?.trim();
      return value ? [{ label: key[0].toUpperCase() + key.slice(1), value }] : [];
    });
    if (!supplied && !legacy.labeled && title.length > 96) fields.push({ label: "Original step", value: description });
    // A category must be a supplied heading, or a role of an explicitly named
    // technology. Do not infer topology from keywords or split prose into nodes.
    const plain = description.replace(/\*\*|__|`/g, "").trim();
    const heading = plain.split(/\s*[:：]\s*/, 1)[0];
    const explicit = categories.find(category => category.toLowerCase() === heading.toLowerCase());
    const technologies = stack.filter(item => mentions(plain, item.technology) || supplied?.technology.some(name => mentions(name, item.technology)));
    if (technologies.length && !fields.some(field => field.label === "Technology")) fields.push({ label: "Technology", value: technologies.map(item => item.technology).join(" · ") });
    const roles = groups.filter(group => group.items.some(item => technologies.includes(item)));
    const category = explicit ?? (roles.length === 1 && roles[0].title !== "Other recommendations" ? roles[0].title : "Workflow");
    return {
      index, description, category, technologies, details: { title: supplied?.title ?? textPreview(title, 96), fields },
      businessLabel: textPreview((values.purpose?.trim() || supplied?.title || label).replace(/\*\*|__|`/g, "").trim(), 96) || "Untitled flow step",
      technicalLabel: textPreview(technologies.map(item => item.technology).join(" · ") || label, 96) || "Untitled flow step",
    };
  });
}
