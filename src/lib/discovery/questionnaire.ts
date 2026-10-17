import { z } from "zod";
import { currencyCodes, serializeBudget } from "./budget";

export const industries = ["Technology", "Retail & e-commerce", "Healthcare", "Financial services", "Education", "Professional services", "Manufacturing", "Other"] as const;
export const challenges = ["Repetitive manual work", "Slow response times", "Disconnected systems", "Inconsistent quality", "Limited visibility", "Scaling operations", "Other"] as const;
export const intendedUsers = ["Customers", "Support agents", "Recruiters", "Operations teams", "Managers", "Developers", "Other internal teams"] as const;
export const goals = ["Save time", "Improve quality", "Improve customer experience", "Reduce operational friction", "Launch a product", "Support growth", "Other"] as const;
export const dataOptions = ["Documents / knowledge base", "Customer conversations", "Structured database", "Spreadsheets", "Application / workflow records", "No data yet", "Unsure"] as const;
export const focuses = ["General discovery", "Customer support", "Recruitment", "Business automation", "SaaS development"] as const;
export const timelines = ["Flexible", "Within 1 month", "1–3 months", "3–6 months", "6+ months"] as const;
const text = z.string().trim().max(2000, "Use at most 2,000 characters.");
const other = z.string().trim().max(300, "Use at most 300 characters.");
const selections = <T extends readonly [string, ...string[]]>(values: T) => z.array(z.enum(values)).max(values.length).refine(v => new Set(v).size === v.length, "Remove duplicate selections.");
const volume = z.string().trim().max(10);

export const draftSchema = z.strictObject({
  industry: z.union([z.enum(industries), z.literal("")]), industryOther: other,
  description: text, customers: text,
  size: z.enum(["", "Solo", "2–10", "11–50", "51–200", "201–1,000", "1,000+"]), tools: text,
  focus: z.enum(focuses), problem: text, workflow: text,
  challenges: selections(challenges), challengesOther: other, users: selections(intendedUsers),
  supportVolume: volume, monthlyApplications: volume, manualHours: volume,
  productStatus: z.enum(["", "New product", "Existing product", "Undecided"]),
  goals: selections(goals), goalsOther: other, success: text,
  timeline: z.enum(timelines), budget: z.string().trim().max(300), budgetCurrency: z.enum(currencyCodes).optional(),
  integrations: z.enum(["Yes", "No"]), integrationDetails: text,
  data: selections(dataOptions), security: text, constraints: text,
});
export type Questionnaire = z.infer<typeof draftSchema>;
export type FieldName = keyof Questionnaire;

export const questionnaireSchema = draftSchema.superRefine((data, ctx) => {
  const issue = (path: FieldName, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  for (const key of ["industry", "description", "problem", "workflow", "success"] as const) {
    if (!data[key]) issue(key, "This field is required.");
  }
  for (const key of ["challenges", "users", "goals"] as const) {
    if (!data[key].length) issue(key, "Choose at least one option.");
  }
  const numeric = data.focus === "Customer support" ? "supportVolume" : data.focus === "Recruitment" ? "monthlyApplications" : data.focus === "Business automation" ? "manualHours" : null;
  if (numeric && data[numeric] && !(/^\d+(\.\d+)?$/.test(data[numeric]) && Number(data[numeric]) <= 10000000)) issue(numeric, "Enter a non-negative number up to 10,000,000.");
  if (data.industry === "Other" && !data.industryOther) issue("industryOther", "Please specify your industry.");
  if (data.challenges.includes("Other") && !data.challengesOther) issue("challengesOther", "Please describe the other challenge.");
  if (data.goals.includes("Other") && !data.goalsOther) issue("goalsOther", "Please describe the other goal.");
  if (data.data.includes("Unsure") && data.data.length > 1) issue("data", "Choose Unsure on its own.");
  if (data.data.includes("No data yet") && data.data.length > 1) issue("data", "Choose No data yet on its own.");
});

export const emptyAnswers: Questionnaire = {
  industry: "", industryOther: "", description: "", customers: "", size: "", tools: "",
  focus: "General discovery", problem: "", workflow: "", challenges: [], challengesOther: "", users: [],
  supportVolume: "", monthlyApplications: "", manualHours: "", productStatus: "",
  goals: [], goalsOther: "", success: "", timeline: "Flexible", budget: "", budgetCurrency: "INR",
  integrations: "No", integrationDetails: "", data: [], security: "", constraints: "",
};
export const steps = ["Business", "Challenge", "Requirements"] as const;
export const stepFields: FieldName[][] = [
  ["industry", "industryOther", "description", "customers", "size", "tools"],
  ["focus", "problem", "workflow", "challenges", "challengesOther", "users", "supportVolume", "monthlyApplications", "manualHours", "productStatus"],
  ["goals", "goalsOther", "success", "timeline", "budget", "integrations", "integrationDetails", "data", "security", "constraints"],
];
export const fieldLabels: Record<FieldName, string> = {
  industry: "Industry", industryOther: "Other industry", description: "Business description", customers: "Target customers", size: "Business size", tools: "Existing software / tools",
  focus: "Discovery focus", problem: "Business problem", workflow: "Current workflow", challenges: "Biggest challenges", challengesOther: "Other challenge", users: "Intended users",
  supportVolume: "Daily support volume", monthlyApplications: "Monthly applications", manualHours: "Weekly manual-work hours", productStatus: "Product stage",
  goals: "Primary goals", goalsOther: "Other goal", success: "Success criteria", timeline: "Timeline", budget: "Budget", budgetCurrency: "Budget currency", integrations: "Integrations needed", integrationDetails: "Integration details", data: "Available data", security: "Security / privacy / compliance", constraints: "Additional constraints",
};

export function normalizeAnswers(data: Questionnaire): Questionnaire {
  return { ...data,
    budget: serializeBudget(data.budget, data.budgetCurrency),
    industryOther: data.industry === "Other" ? data.industryOther : "",
    challengesOther: data.challenges.includes("Other") ? data.challengesOther : "",
    goalsOther: data.goals.includes("Other") ? data.goalsOther : "",
    integrationDetails: data.integrations === "Yes" ? data.integrationDetails : "",
    supportVolume: data.focus === "Customer support" ? data.supportVolume : "",
    monthlyApplications: data.focus === "Recruitment" ? data.monthlyApplications : "",
    manualHours: data.focus === "Business automation" ? data.manualHours : "",
    productStatus: data.focus === "SaaS development" ? data.productStatus : "",
  };
}
export function validateStep(data: Questionnaire, step: number): Partial<Record<FieldName, string>> {
  const parsed = questionnaireSchema.safeParse(normalizeAnswers(data));
  const errors: Partial<Record<FieldName, string>> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const key = issue.path[0] as FieldName;
    if (stepFields[step]?.includes(key) && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
