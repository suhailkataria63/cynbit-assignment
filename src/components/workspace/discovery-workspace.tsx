"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { QuestionnaireFields } from "@/components/discovery/questionnaire-fields";
import { QuestionnaireReview } from "@/components/discovery/questionnaire-review";
import { GenerationDetails } from "@/components/discovery/generation-details";
import { BlueprintResults } from "@/components/discovery/blueprint-results";
import { normalizeAnswers, questionnaireSchema, steps, validateStep, type FieldName } from "@/lib/discovery/questionnaire";
import { DAILY_LIMIT, freshSession, readBudget, readSession, saveSession, type DiscoverySession } from "@/lib/discovery/storage";
import { CacheSaveError, GenerationRequestError, generateBlueprint } from "@/lib/discovery/generate";
import { cn } from "@/lib/cn";

const subscribe = () => () => {};
function initialSession() {
  let session = freshSession(); let warning = ""; let attempts = DAILY_LIMIT;
  try { session = readSession(localStorage) ?? session; }
  catch { warning = "The saved discovery could not be restored. A new questionnaire is ready; your testing budget has not been reset."; }
  try { attempts = readBudget(localStorage); }
  catch { warning = "Browser storage or the usage record is unavailable. Generation is disabled to protect the testing budget. A corrupt usage record is not reset automatically."; }
  return { session, warning, attempts };
}
export function DiscoveryWorkspace() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <DiscoveryWizard /> : <main id="main-content" className="grid min-h-dvh place-items-center"><p role="status" className="text-sm text-muted">Loading your discovery…</p></main>;
}
function DiscoveryWizard() {
  const [initial] = useState(initialSession);
  const [session, setSession] = useState(initial.session);
  const [warning, setWarning] = useState(initial.warning);
  const [attempts, setAttempts] = useState(initial.attempts);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const results = session.view === "results" && !!session.result;
  const locked = !!session.result;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const refresh = () => { try { setAttempts(readBudget(localStorage)); } catch { setAttempts(DAILY_LIMIT); } };
    window.addEventListener("storage", refresh);
    const timer = setInterval(refresh, 60_000);
    return () => { window.removeEventListener("storage", refresh); clearInterval(timer); };
  }, []);
  function commit(next: DiscoverySession) {
    setSession(next);
    try { saveSession(localStorage, next); setWarning(""); }
    catch { setWarning("This browser could not save your discovery. Keep this tab open and export any generated result. Generation requires local storage."); }
  }
  function move(step: number) {
    setErrors({}); setError(""); commit({ ...session, step, view: "questionnaire" });
    requestAnimationFrame(() => heading.current?.focus());
  }
  function next() {
    const found = validateStep(session.answers, session.step);
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => errorSummary.current?.focus()); return; }
    move(Math.min(3, session.step + 1));
  }
  function update(key: FieldName, value: string | string[]) {
    commit({ ...session, answers: { ...session.answers, [key]: value } });
    setErrors(previous => ({ ...previous, [key]: undefined }));
  }
  function showResult() {
    commit({ ...session, view: "results" });
    requestAnimationFrame(() => heading.current?.focus());
  }
  function reset() {
    if (busy.current) return;
    commit(freshSession()); setErrors({}); setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function generate() {
    if (busy.current) return;
    if (session.result) { showResult(); return; }
    const parsed = questionnaireSchema.safeParse(normalizeAnswers(session.answers));
    if (!parsed.success) { setError("Please review all required fields before generating."); return; }
    busy.current = true; setLoading(true); setError("");
    controller.current = new AbortController();
    try {
      if (!navigator.locks) throw new Error("Generation requires browser Web Locks. Use a current browser on localhost or HTTPS.");
      await navigator.locks.request("cynbit-blueprint-generation", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is generating a blueprint. Wait for it to finish; no request was sent.");
        const completed = await generateBlueprint(session, localStorage, fetch, controller.current!.signal);
        setSession(completed);
        setWarning("");
        requestAnimationFrame(() => heading.current?.focus());
      });
    } catch (failure) {
      if (failure instanceof CacheSaveError) { setSession(failure.session); setWarning(failure.message); return; }
      if (failure instanceof GenerationRequestError) setSession(failure.session);
      setError(failure instanceof Error ? failure.message : "Generation failed. Your answers are preserved.");
    } finally {
      try { setAttempts(readBudget(localStorage)); } catch { setAttempts(DAILY_LIMIT); }
      busy.current = false; setLoading(false); controller.current = null;
    }
  }
  const title = results ? "Your solution blueprint." : session.step === 3 ? "A moment to review." : ["Let’s understand your vision.", "Find the challenge worth solving.", "Define what success looks like."][session.step];
  return <div className="min-h-dvh bg-background">
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-xl"><div className="mx-auto flex min-h-20 max-w-wide flex-wrap items-center justify-between gap-3 px-gutter py-3"><Logo /><span className="hidden text-xs text-muted md:block">{results ? "AI Solutions Architect / Blueprint Studio" : "AI Solutions Architect / Guided Discovery"}</span><div className="flex items-center gap-2"><ThemeToggle /><Button variant="secondary" size="sm" disabled={loading} onClick={reset}><Plus aria-hidden="true" /> New Discovery</Button></div></div></header>
    <div className={results ? "mx-auto max-w-wide px-gutter py-6 lg:py-8" : "mx-auto grid max-w-content gap-8 px-gutter py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14 lg:py-12"}>
      {!results && <aside aria-label="Discovery navigation" className="lg:sticky lg:top-28 lg:self-start">
        <Link href="/" className="mb-7 inline-flex min-h-10 items-center gap-2 text-xs text-muted hover:text-accent"><ArrowLeft size={14} aria-hidden="true" /> Back to home</Link>
        <p className="mb-4 text-xs font-semibold">Your discovery</p>
        <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">{steps.map((step, i) => <li key={step}><button disabled={loading || (!locked && i > session.step)} onClick={() => move(i)} aria-current={!results && session.step === i ? "step" : undefined} className={cn("flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs disabled:cursor-default lg:gap-3", !results && session.step === i ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-muted hover:border-border")}><span className="grid size-6 shrink-0 place-items-center rounded-full border border-current/25 text-[10px]">{session.step > i || locked ? <Check size={12} aria-hidden="true" /> : i + 1}</span><span>{step}</span></button></li>)}</ol>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(session.step, 3)}><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(session.step, 3) / 3 * 100}%` }} /></div>
        <p className="mt-3 text-[11px] text-muted">{session.step === 3 ? "Ready for review" : `Stage ${session.step + 1} of 3`}</p>
        <div className="mt-7 rounded-xl border border-border bg-surface p-4"><p className="flex items-center gap-2 text-xs font-medium"><ShieldCheck size={15} className="text-accent" aria-hidden="true" /> You control generation</p><p className="mt-2 text-[11px] leading-relaxed text-muted">No AI calls while you fill in the form. Generate sends your reviewed answers to the configured provider.</p><p className="mt-3 text-xs font-semibold text-accent" aria-live="polite">{Math.max(0, DAILY_LIMIT - attempts)} of {DAILY_LIMIT} attempts remaining today</p><p className="mt-1 text-[10px] text-muted">Browser testing budget · resets daily</p></div>
      </aside>}
      <main id="main-content" className={results ? "studio-results-page min-w-0 pb-12" : "min-w-0 max-w-3xl pb-12"}>
        <p className="eyebrow mb-4">{results ? "FROM DISCOVERY TO DIRECTION" : session.step === 3 ? "YOUR BUSINESS, IN FOCUS" : "BUSINESS FIRST. TECHNOLOGY WITH PURPOSE."}</p>
        <h1 ref={heading} tabIndex={-1} className="mb-4 text-[clamp(2.75rem,5vw,4.25rem)] leading-[1.06] outline-none">{title}</h1>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted">{results ? "A structured starting point grounded in the answers you supplied." : session.step === 3 ? "Check your answers before sending them for a single AI-generated blueprint. Eight primary fields are required; optional details help make the recommendation more useful." : "Share what you know. Fields marked * are required. Your progress is saved in this browser; avoid entering secrets or sensitive personal information."}</p>
        {results && <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted"><span className="font-medium text-accent" aria-live="polite">{Math.max(0, DAILY_LIMIT - attempts)} of {DAILY_LIMIT} attempts remaining today</span><span>Browser testing budget · saved views use no requests</span></p>}
        {warning && <p role="status" className="mb-6 rounded-xl border border-warning-border bg-warning-surface p-4 text-xs text-warning">{warning}</p>}
        {error && <p role="alert" className="mb-6 rounded-xl border border-error-border bg-error-surface p-4 text-sm text-error">{error}</p>}
        {!locked && session.lastGeneration && <GenerationDetails details={session.lastGeneration} />}
        {locked && !results && <div className="mb-6 rounded-xl border border-accent/20 bg-accent-soft/40 p-4 text-xs"><p>These answers are locked to your saved blueprint. Use New Discovery to revise them and generate another.</p><Button variant="secondary" size="sm" className="mt-3" onClick={showResult}>View saved blueprint <ArrowRight aria-hidden="true" /></Button></div>}
        {results && session.result ? <BlueprintResults result={session.result} onBack={() => move(3)} /> : <form noValidate onSubmit={event => { event.preventDefault(); if (session.step < 3) next(); }}>
          {Object.values(errors).some(Boolean) && <div ref={errorSummary} tabIndex={-1} role="alert" className="mb-6 rounded-xl border border-error-border bg-error-surface p-4 text-sm text-error">Please complete the highlighted fields before continuing.</div>}
          {session.step < 3 ? <fieldset disabled={loading || locked}><legend className="sr-only">{steps[session.step]} questions</legend><QuestionnaireFields answers={session.answers} errors={errors} update={update} step={session.step} /></fieldset> : <QuestionnaireReview answers={session.answers} edit={move} locked={locked} />}
          <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6"><Button variant="secondary" disabled={session.step === 0 || loading} onClick={() => move(session.step - 1)}><ArrowLeft aria-hidden="true" /> Back</Button>{session.step < 3 ? <Button type="submit">{session.step === 2 ? "Review answers" : "Next"}<ArrowRight aria-hidden="true" /></Button> : locked ? <Button onClick={showResult}>View saved blueprint</Button> : <Button disabled={loading || attempts >= DAILY_LIMIT} onClick={() => void generate()}>{loading ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> Generating blueprint…</> : <><Sparkles aria-hidden="true" /> Generate Blueprint</>}</Button>}</div>
          {session.step === 3 && !locked && <p className="mt-4 text-xs leading-relaxed text-muted">Generate uses one attempted request from your daily budget, including provider errors or 429 responses. There are no automatic retries. A successful blueprint is saved and will not be regenerated on revisit.</p>}
          {loading && <p role="status" className="mt-4 text-sm text-accent">Generating all blueprint sections. This may take up to a minute. Please keep this tab open.</p>}
        </form>}
      </main>
    </div>
  </div>;
}
