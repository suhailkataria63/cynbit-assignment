import { currencies, parseBudget, type Currency } from "@/lib/discovery/budget";
import type { ReactNode } from "react";
import { challenges, dataOptions, fieldLabels, focuses, goals, industries, intendedUsers, timelines, type FieldName, type Questionnaire } from "@/lib/discovery/questionnaire";

type Errors = Partial<Record<FieldName, string>>;
interface Props { answers: Questionnaire; update: (key: FieldName, value: string | string[]) => void; errors: Errors; step: number }
const requiredFields = new Set<FieldName>(["industry", "description", "problem", "workflow", "challenges", "users", "goals", "success"]);
const inputClass = "w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 disabled:bg-surface-muted disabled:text-muted";

function Field({ name, children, hint, error, hintBelow = false }: { name: FieldName; children: ReactNode; hint?: string; error?: string; hintBelow?: boolean }) {
    return <div className="min-w-0 space-y-2"><label htmlFor={`field-${name}`} className="block text-sm font-medium">{fieldLabels[name]} {(requiredFields.has(name) || ["industryOther", "challengesOther", "goalsOther"].includes(name)) ? <span aria-label="required" className="text-accent">*</span> : <span className="text-xs font-normal text-muted">(optional)</span>}</label>{hint && !hintBelow && <p id={`hint-${name}`} className="text-xs text-muted">{hint}</p>}{children}{hint && hintBelow && <p id={`hint-${name}`} className="text-xs text-muted">{hint}</p>}{error && <p id={`error-${name}`} className="text-xs text-error-field">{error}</p>}</div>;
  }

export function QuestionnaireFields({ answers, update, errors, step }: Props) {
  const budget = parseBudget(answers.budget, answers.budgetCurrency);
  const accessibility = (name: FieldName) => ({ id: `field-${name}`, name, "aria-invalid": !!errors[name], "aria-describedby": [errors[name] ? `error-${name}` : "", ["description", "success", "budget"].includes(name) ? `hint-${name}` : ""].filter(Boolean).join(" ") || undefined });
  const text = (name: FieldName, options: { multiline?: boolean; hint?: string; placeholder?: string; number?: boolean } = {}) => <Field key={name} name={name} hint={options.hint} error={errors[name]}>{options.multiline ? <textarea {...accessibility(name)} required={(requiredFields.has(name) || ["industryOther", "challengesOther", "goalsOther"].includes(name))} value={answers[name] as string} onChange={event => update(name, event.target.value)} maxLength={2000} rows={3} className={inputClass} placeholder={options.placeholder} /> : <input {...accessibility(name)} type="text" inputMode={options.number ? "decimal" : undefined} required={(requiredFields.has(name) || ["industryOther", "challengesOther", "goalsOther"].includes(name))} value={answers[name] as string} onChange={event => update(name, event.target.value)} maxLength={options.number ? 10 : ["industryOther", "challengesOther", "goalsOther", "budget"].includes(name) ? 300 : 2000} className={inputClass} placeholder={options.placeholder} />}</Field>;
  const select = (name: FieldName, options: readonly string[], placeholder?: string) => <Field key={name} name={name} error={errors[name]}><select {...accessibility(name)} required={(requiredFields.has(name) || ["industryOther", "challengesOther", "goalsOther"].includes(name))} value={answers[name] as string} onChange={event => update(name, event.target.value)} className={inputClass}>{placeholder && <option value="">{placeholder}</option>}{options.map(value => <option key={value} value={value}>{value}</option>)}</select></Field>;
  const multi = (name: "challenges" | "users" | "goals" | "data", options: readonly string[]) => <fieldset className="space-y-3" aria-describedby={errors[name] ? `error-${name}` : undefined}><legend className="text-sm font-medium">{fieldLabels[name]} {(requiredFields.has(name) || ["industryOther", "challengesOther", "goalsOther"].includes(name)) ? <span aria-label="required" className="text-accent">*</span> : <span className="text-xs font-normal text-muted">(optional)</span>}</legend><div className="grid gap-2 sm:grid-cols-2">{options.map((value, i) => <label key={value} htmlFor={`field-${name}-${i}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs has-checked:border-accent/50 has-checked:bg-accent-soft/40"><input id={`field-${name}-${i}`} type="checkbox" checked={(answers[name] as string[]).includes(value)} onChange={event => { let next = event.target.checked ? [...answers[name], value] : answers[name].filter(item => item !== value); if (name === "data" && event.target.checked) next = ["Unsure", "No data yet"].includes(value) ? [value] : next.filter(item => !["Unsure", "No data yet"].includes(item)); update(name, next); }} className="size-4 shrink-0 accent-accent" />{value}</label>)}</div>{errors[name] && <p id={`error-${name}`} className="text-xs text-error-field">{errors[name]}</p>}</fieldset>;
  return <div className="space-y-7">
    {step === 0 && <>
      {select("industry", industries, "Select an industry")}
      {answers.industry === "Other" && text("industryOther", { placeholder: "Specify your industry" })}
      {text("description", { multiline: true, hint: "What does your business do? Do not include secrets or personal records.", placeholder: "Describe your business and the value you provide…" })}
      {text("customers", { multiline: true, placeholder: "Who do you serve?" })}
      {select("size", ["Solo", "2–10", "11–50", "51–200", "201–1,000", "1,000+"], "Select team size")}
      {text("tools", { placeholder: "Tools, platforms, or systems you use today" })}
    </>}
    {step === 1 && <>
      {select("focus", focuses)}
      {text("problem", { multiline: true, placeholder: "What problem would you like to solve?" })}
      {text("workflow", { multiline: true, placeholder: "Walk through the process as it works today…" })}
      {multi("challenges", challenges)}
      {answers.challenges.includes("Other") && text("challengesOther", { placeholder: "Describe the other challenge" })}
      {multi("users", intendedUsers)}
      {answers.focus === "Customer support" && text("supportVolume", { number: true, placeholder: "Approximate support requests per day" })}
      {answers.focus === "Recruitment" && text("monthlyApplications", { number: true, placeholder: "Approximate applications per month" })}
      {answers.focus === "Business automation" && text("manualHours", { number: true, placeholder: "Approximate team hours per week" })}
      {answers.focus === "SaaS development" && select("productStatus", ["New product", "Existing product", "Undecided"], "Select product stage")}
    </>}
    {step === 2 && <>
      {multi("goals", goals)}
      {answers.goals.includes("Other") && text("goalsOther", { placeholder: "Describe the other goal" })}
      {text("success", { multiline: true, hint: "Describe observable outcomes. If you have targets or baselines, include them.", placeholder: "How will you know the solution is working?" })}
      <div className="grid gap-6 md:grid-cols-2" data-testid="timeline-budget">
        <Field name="timeline"><select {...accessibility("timeline")} value={answers.timeline} onChange={event => update("timeline", event.target.value)} className={`${inputClass} h-12`}>{timelines.map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
        <Field name="budget" hint="Optional. Enter an amount or range." hintBelow error={errors.budget}>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <select id="field-budgetCurrency" aria-label="Budget currency" value={budget.currency} onChange={event => update("budgetCurrency", event.target.value as Currency)} className={`${inputClass} h-12 min-w-0 truncate`}>
              {!budget.currency && <option value="">Currency not recorded</option>}
              {currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
            </select>
            <input {...accessibility("budget")} type="text" value={budget.amount} onChange={event => update("budget", event.target.value && budget.currency ? `${budget.currency} ${event.target.value}` : event.target.value)} maxLength={296} placeholder="e.g. 300,000–500,000" className={`${inputClass} h-12 min-w-0`} />
          </div>
          {!budget.currency && <p className="text-xs text-muted">Your saved amount has no recorded currency. Select one to specify it.</p>}
        </Field>
      </div>
      {select("integrations", ["No", "Yes"])}
      {answers.integrations === "Yes" && text("integrationDetails", { multiline: true, placeholder: "Which systems should connect, and how? Share what you know." })}
      {multi("data", dataOptions)}
      {text("security", { multiline: true, placeholder: "Access controls, privacy, residency, or compliance needs" })}
      {text("constraints", { multiline: true, placeholder: "Team capacity, technical limitations, or other considerations" })}
    </>}
  </div>;
}
