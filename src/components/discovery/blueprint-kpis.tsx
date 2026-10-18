"use client";

import { useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import type { Blueprint } from "@/lib/blueprint/schema";
import { targetSourceLabel } from "@/lib/blueprint/presentation";
import { Button } from "@/components/ui/button";
import { CompactText, InlineText, ReportText } from "./studio-text";
import { numericTarget } from "./studio-content";

export function BlueprintKpis({ blueprint: b }: { blueprint: Blueprint }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const criteria = b.userSuccessCriteria ? [{ metric: "User-stated success criteria", target: b.userSuccessCriteria, baseline: null, targetSource: "user-provided" as const, measurement: "Agree on the baseline and measurement method for these supplied criteria before evaluating outcomes." }] : [];
  const kpis = [...criteria, ...b.kpis];
  const target = (value: string | undefined) => value?.trim() ? value : "Needs clarification";
  return <section aria-label="Measurable KPIs">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="studio-card-heading">Measurable KPIs</h3><div className="flex gap-1 rounded-xl border border-border bg-background p-1" role="group" aria-label="KPI display"><Button variant={view === "cards" ? "secondary" : "ghost"} size="sm" className="min-h-9 px-3 text-xs" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid aria-hidden="true" /> Card view</Button><Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="min-h-9 px-3 text-xs" aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 aria-hidden="true" /> Table view</Button></div></div>
    <p className="mb-4 studio-secondary">Proposed targets, not achieved results. User goals are preserved; AI recommendations are additional or alternative proposals. Unknown baselines are not measured outcomes.</p>
    <div hidden={view !== "cards"}><div className="studio-kpi-grid grid gap-3 xl:grid-cols-2">{kpis.map((item, i) => {
      const fullTarget = target(item.target);
      const source = item.target?.trim() ? item.targetSource : "needs-clarification";
      const number = source === "needs-clarification" ? null : numericTarget(fullTarget);
      return <article key={i} className="studio-kpi studio-hover" data-source={source ?? "unknown"} aria-label={item.metric}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><h4 className="studio-card-heading"><InlineText text={item.metric} /></h4><span className="studio-source">{targetSourceLabel(source)}</span></div>
        <div className="studio-kpi-target"><p className="studio-label mb-1 text-muted">Proposed target</p>{number && <p className="studio-kpi-number">{number}</p>}{number !== fullTarget && <CompactText text={fullTarget} label="Full target — exact wording" limit={135} />}</div>
        <dl className="studio-kpi-meta space-y-3 border-t border-border pt-3"><div><dt className="font-medium text-foreground">Current baseline</dt><dd className="mt-1"><ReportText text={item.baseline?.trim() ? item.baseline : "Not provided"} /></dd></div><div><dt className="font-medium text-foreground">Measurement method</dt><dd className="mt-1"><CompactText text={item.measurement} label="Complete measurement method" limit={140} /></dd></div></dl>
      </article>;
    })}</div></div>
    <div hidden={view !== "table"}><div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Scrollable KPI table"><table className="studio-kpi-table w-full border-collapse text-left"><caption className="sr-only">Measurable KPIs: current baselines, future targets and how to measure them.</caption><colgroup><col style={{ width: "25%" }} /><col style={{ width: "15%" }} /><col style={{ width: "25%" }} /><col style={{ width: "35%" }} /></colgroup><thead className="bg-background text-foreground"><tr>{["KPI", "Current Baseline", "Proposed Target", "Measurement Method"].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{kpis.map((item, i) => <tr key={i} className="border-t border-border align-top"><th scope="row" className="px-4 py-4 font-semibold text-foreground"><InlineText text={item.metric} /></th><td className="px-4 py-4"><ReportText text={item.baseline?.trim() ? item.baseline : "Not provided"} /></td><td className="px-4 py-4"><ReportText text={target(item.target)} /><span className="studio-source mt-2 inline-block">{targetSourceLabel(item.target?.trim() ? item.targetSource : "needs-clarification")}</span></td><td className="px-4 py-4"><ReportText text={item.measurement} /></td></tr>)}</tbody></table></div></div>
  </section>;
}
