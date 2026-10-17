import type { Blueprint } from "@/lib/blueprint/schema";
import { groupTechnologies, textPreview } from "./studio-content";

const categories = ["Data Sources", "Ingestion", "Storage", "AI/ML Processing", "Application", "Human Review", "Output"] as const;

function mentions(text: string, name: string) {
  if (!name.trim()) return false;
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export function architectureNodes(architecture: Blueprint["architecture"], stack: Blueprint["techStack"]) {
  const groups = groupTechnologies(stack);
  return architecture.dataFlow.map((description, index) => {
    // A category must be a supplied heading, or a role of an explicitly named
    // technology. Do not infer topology from keywords or split prose into nodes.
    const plain = description.replace(/\*\*|__|`/g, "").trim();
    const heading = plain.split(/\s*[:：]\s*/, 1)[0];
    const explicit = categories.find(category => category.toLowerCase() === heading.toLowerCase());
    const technologies = stack.filter(item => mentions(plain, item.technology));
    const roles = groups.filter(group => group.items.some(item => technologies.includes(item)));
    const category = explicit ?? (roles.length === 1 && roles[0].title !== "Other recommendations" ? roles[0].title : "Workflow");
    return {
      index, description, category, technologies,
      businessLabel: textPreview(plain, 96) || "Untitled flow step",
      technicalLabel: textPreview(technologies.map(item => item.technology).join(" · ") || plain, 96) || "Untitled flow step",
    };
  });
}
