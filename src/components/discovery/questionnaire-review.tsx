import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldLabels, normalizeAnswers, stepFields, steps, type Questionnaire } from "@/lib/discovery/questionnaire";

export function QuestionnaireReview({ answers, edit, locked }: { answers: Questionnaire; edit: (step: number) => void; locked: boolean }) {
  const clean = normalizeAnswers(answers);
  return <div className="space-y-5">{steps.map((step, i) => <section key={step} aria-label={`${step} review`} className="rounded-2xl border border-border bg-surface p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-sans text-base font-semibold">{step}</h2><Button variant="ghost" size="sm" className="min-h-9 px-2 text-xs" onClick={() => edit(i)} aria-label={`${locked ? "View" : "Edit"} ${step.toLowerCase()} answers`}><Pencil size={13} aria-hidden="true" />{locked ? "View" : "Edit"}</Button></div><dl className="space-y-4">{stepFields[i].map(key => { const value = clean[key]; if (!value?.length) return null; return <div key={key}><dt className="text-xs font-medium">{fieldLabels[key]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-muted [overflow-wrap:anywhere]">{Array.isArray(value) ? value.join(", ") : value}</dd></div>; })}</dl></section>)}</div>;
}
