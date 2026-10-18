import type { BlueprintResult } from "../src/lib/blueprint/schema";
import { emptyAnswers, type Questionnaire } from "../src/lib/discovery/questionnaire";

export const answers: Questionnaire = {
  ...emptyAnswers, industry: "Retail & e-commerce", description: "We sell household products online.",
  customers: "Retail shoppers", tools: "A shared support inbox", focus: "Customer support",
  problem: "Agents spend time answering repeated delivery questions.", workflow: "Agents search help articles and write replies manually.",
  challenges: ["Repetitive manual work"], users: ["Support agents"], goals: ["Improve quality"],
  success: "Track answer accuracy and handling time during a supervised pilot.", supportVolume: "50",
};
export const result: BlueprintResult = {
  metadata: { provider: "groq", model: "openai/gpt-oss-120b", generatedAt: "2026-10-17T12:00:00.000Z" },
  blueprint: {
    executiveSummary: "Pilot reviewed support drafts against approved help content.",
    analysis: { problem: "Manual repeated delivery answers consume agent effort.", requirements: ["Agents review every outgoing reply."] },
    solution: { proposal: "A knowledge search and draft assistant.", justification: "Supports repeated requests while preserving agent control." },
    feasibility: { recommendation: "Further discovery needed", rationale: "Validate knowledge quality before selecting AI.", dataReadiness: "Approved content availability needs confirmation." },
    techStack: [{ component: "Web interface", technology: "Next.js", rationale: "A responsive agent workspace." }],
    architecture: { overview: "An authenticated API connects agents to permitted help content.", dataFlow: ["Agent question → permitted content → reviewed draft."] },
    roadmap: [{ phase: "Discovery", deliverables: ["Review source quality and permissions."], exitCriteria: "Agents approve a representative evaluation set." }],
    risks: ["Outdated content may create incorrect drafts."], assumptions: ["Agents can review suggestions during a pilot."],
    missingInformation: ["Helpdesk integration details are unspecified."], limitations: ["No external system or business facts were verified."],
    benefits: ["A hypothesis of less repetitive writing, to be measured."],
    kpis: [{ metric: "Answer accuracy", measurement: "Establish a baseline using agent-reviewed samples.", target: "To be agreed after baseline measurement" }],
    nextSteps: ["Agree on pilot scope with support agents."],
  },
};

// Retain `result` above as an exact Phase 3 cache fixture.
export const generatedResult: BlueprintResult = {
  ...result,
  metadata: { ...result.metadata, usage: { inputTokens: 1234, outputTokens: 567, totalTokens: 1801, durationMs: 8200, requestedAt: "2026-10-17T11:59:51.800Z", status: "success" } },
  blueprint: { ...result.blueprint,
    architecture: { ...result.blueprint.architecture, stepDetails: [{
      title: "Prepare a reviewed support draft",
      purpose: "Support agents answering repeated delivery questions using permitted help content.",
      input: "An agent question and permitted help content.",
      process: "Search the permitted content and prepare a draft for agent review.",
      output: "A draft for an agent to review before replying.",
      technology: [],
    }] },
    roadmap: result.blueprint.roadmap.map(phase => ({ ...phase, activities: ["Interview support agents and audit content."] })),
    kpis: [
      { ...result.blueprint.kpis[0], baseline: null, targetSource: "unspecified" },
      { metric: "First reply time", baseline: "Current median 2 hours, supplied by the business", target: "Under 1 hour", targetSource: "user-provided", measurement: "Compare helpdesk response-time logs against the supplied baseline." },
      { metric: "Reviewed draft quality", baseline: null, target: "Pilot a reviewed quality threshold, to be agreed", targetSource: "AI-proposed", measurement: "Score a representative agent-reviewed evaluation set." },
    ],
  },
};
