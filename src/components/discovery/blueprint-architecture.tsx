"use client";

import { useId, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Boxes, BrainCircuit, ChevronDown, Database, FileInput, Layers3, Monitor, ShieldCheck, UserRoundCheck, Workflow } from "lucide-react";
import type { Blueprint } from "@/lib/blueprint/schema";
import { Button } from "@/components/ui/button";
import { InlineText, ReportText } from "./studio-text";
import { architectureNodes } from "./architecture-flow";

const categoryIcons = { "Data Sources": FileInput, Ingestion: ArrowDownToLine, Storage: Database, Data: Database, "AI/ML Processing": BrainCircuit, "AI / ML": BrainCircuit, Application: Monitor, "Human Review": UserRoundCheck, Output: Layers3, Infrastructure: Boxes, Security: ShieldCheck };

function Connector({ direction }: { direction: string }) {
  const reduced = useReducedMotion();
  const animation = reduced ? undefined : { pathLength: [0, 1], opacity: [0.3, 1] };
  return <span className="studio-architecture-connector" data-direction={direction} aria-hidden="true">
    <svg className="studio-architecture-arrow-down" viewBox="0 0 24 40" fill="none"><motion.path d="M12 3V34M7 29L12 34L17 29" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" initial={false} whileInView={animation} viewport={{ once: true }} transition={{ duration: 0.65 }} /></svg>
    <svg className="studio-architecture-arrow-across" viewBox="0 0 40 24" fill="none"><motion.path d="M3 12H34M29 7L34 12L29 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" initial={false} whileInView={animation} viewport={{ once: true }} transition={{ duration: 0.65 }} /></svg>
  </span>;
}

export function BlueprintArchitecture({ architecture, stack }: { architecture: Blueprint["architecture"]; stack: Blueprint["techStack"] }) {
  const [view, setView] = useState<"business" | "technical">("business");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const id = useId();
  const nodes = architectureNodes(architecture, stack);
  const node = nodes[selected] ?? nodes[0];
  const visibleFields = node?.details.fields.filter(field => view === "technical" || field.label === "Purpose" || field.label === "Original step") ?? [];
  return <div className="studio-architecture-report">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="studio-secondary">Explore the proposed workflow</p><div className="studio-architecture-view-toggle" role="group" aria-label="Architecture view">{(["business", "technical"] as const).map(value => <Button key={value} size="sm" variant={view === value ? "secondary" : "ghost"} className="min-h-10 px-3 text-xs" aria-pressed={view === value} onClick={() => setView(value)}>{value === "business" ? "Business View" : "Technical View"}</Button>)}</div></div>
    <p className="mb-4 studio-secondary">{view === "business" ? "Focus on each step’s purpose. Switch to Technical View for inputs, processing, outputs and technologies." : "Saved flow descriptions and explicitly named technologies. Select a component to inspect the supplied details."}</p>
    <div className="studio-architecture-diagram" data-view={view}>
      {nodes.length ? <ol className="studio-architecture-grid" aria-label="Architecture flow in saved order">{nodes.map((item, index) => {
        const row = Math.floor(index / 3);
        const column = row % 2 === 0 ? index % 3 : 2 - index % 3;
        const direction = index % 3 === 2 ? "down" : row % 2 === 0 ? "right" : "left";
        const Icon = categoryIcons[item.category as keyof typeof categoryIcons] ?? Workflow;
        return <li key={index} style={{ "--flow-column": column + 1, "--flow-row": row + 1 } as CSSProperties}>
          <button type="button" className="studio-architecture-node" aria-pressed={node?.index === index} aria-controls={`${id}-node-details`} aria-label={`Step ${index + 1}: ${view === "business" ? item.businessLabel : item.technicalLabel}`} onClick={() => setSelected(index)}>
            <span className="studio-architecture-node-meta"><span className="studio-architecture-node-icon"><Icon size={17} aria-hidden="true" /></span><span className="studio-label">{item.category}</span><span className="studio-architecture-node-index">{String(index + 1).padStart(2, "0")}</span></span>
            <span className="studio-architecture-node-title"><InlineText text={view === "business" ? item.businessLabel : item.technicalLabel} /></span>
          </button>
          {index < nodes.length - 1 && <Connector direction={direction} />}
        </li>;
      })}</ol> : <p className="studio-secondary">No individual flow steps were provided. The original architecture description is available below.</p>}
    </div>
    {nodes.length > 0 && <p className="mt-3 studio-secondary">Arrows show the saved step order, not independently verified system dependencies.</p>}
    {node && <div id={`${id}-node-details`} className="studio-architecture-node-details mt-4" role="region" aria-label="Selected flow step" aria-live="polite" aria-atomic="true"><motion.div key={`${view}-${node.index}`} initial={false} animate={reduced ? undefined : { opacity: [0.6, 1] }} transition={{ duration: 0.2 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="studio-card-heading"><span className="studio-label mr-2 text-accent">Step {node.index + 1}</span>{node.details.title ? <InlineText text={node.details.title} /> : "Details"}</h4><span className="studio-source">{node.category}</span></div>
      {visibleFields.length > 0 && <dl className="studio-architecture-step-fields">{visibleFields.map(field => <div key={field.label}><dt className="studio-label mb-1 text-muted">{field.label}</dt><dd><ReportText text={field.value} /></dd></div>)}</dl>}
      {view === "technical" && node.technologies.length > 0 && <dl className="studio-architecture-technical-details">{node.technologies.map((item, index) => <div key={index}><dt className="font-semibold text-foreground"><InlineText text={item.technology} /></dt><dd className="mt-1"><span className="font-medium text-foreground">Role: </span><InlineText text={item.component} /></dd><dd className="mt-2"><span className="font-medium text-foreground">Technical considerations: </span><InlineText text={item.rationale} /></dd></div>)}</dl>}
    </motion.div></div>}
    <div className="studio-architecture-full-description mt-4">
      <Button variant="ghost" className="w-full justify-between px-4 text-left text-sm text-accent" aria-expanded={expanded} aria-controls={`${id}-description`} onClick={() => setExpanded(value => !value)}><span>Show full architecture description</span><ChevronDown className={expanded ? "rotate-180" : ""} aria-hidden="true" /></Button>
      <div id={`${id}-description`} hidden={!expanded} className="studio-architecture-description-content"><ReportText text={architecture.overview} />{architecture.dataFlow.length > 0 && <div className="mt-4"><h4 className="studio-card-heading mb-3">Original data flow</h4><ol className="list-decimal space-y-3 pl-5 marker:text-accent">{architecture.dataFlow.map((step, index) => <li key={index}><ReportText text={step} /></li>)}</ol></div>}</div>
    </div>
  </div>;
}
