"use client";

import { useState } from "react";
import { ChevronDown, Copy, Download } from "lucide-react";
import { GenerationDetails } from "./generation-details";
import { BlueprintSectionContent } from "./blueprint-section-content";
import { Button } from "@/components/ui/button";
import { blueprintSections, blueprintText } from "@/lib/blueprint/presentation";
import type { BlueprintResult } from "@/lib/blueprint/schema";

export function BlueprintResults({ result }: { result: BlueprintResult }) {
  const [notice, setNotice] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(blueprintText(result)); setNotice("Blueprint copied to clipboard."); }
    catch { setNotice("Clipboard access was unavailable. Use Export JSON to save your cached blueprint."); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "cynbit-blueprint.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Cached blueprint exported. No AI request was made.");
  }
  return <div>
    <div className="mb-7 rounded-2xl border border-accent/20 bg-accent-soft/40 p-5"><p className="text-xs font-semibold text-accent">AI-generated · Review before implementation</p><p className="mt-2 text-xs leading-relaxed text-muted">This blueprint is a starting point, not a validated specification or a guarantee of accuracy, cost, compliance, or outcomes. Check its assumptions and missing information with your team.</p></div>
    <GenerationDetails details={result.metadata} />
    <p className="mb-4 text-xs text-muted">Generated <time dateTime={result.metadata.generatedAt}>{new Date(result.metadata.generatedAt).toLocaleString()}</time></p>
    <div className="mb-3 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => void copy()}><Copy aria-hidden="true" /> Copy blueprint</Button><Button variant="secondary" size="sm" onClick={download}><Download aria-hidden="true" /> Export JSON</Button></div>
    <p className="mb-6 min-h-5 text-xs text-accent" role="status">{notice}</p>
    <div className="space-y-3">{blueprintSections(result).map((section, i) => <details key={section.title} open={i === 0} className="group rounded-2xl border border-border bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-3"><span className="text-[10px] font-normal text-muted">{String(i + 1).padStart(2, "0")}</span>{section.title}</span><ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" /></summary><div className="space-y-4 break-words [overflow-wrap:anywhere] border-t border-border/60 px-5 py-5 text-sm leading-relaxed text-muted"><BlueprintSectionContent id={section.id} blueprint={result.blueprint} lines={section.lines} /></div></details>)}</div>
    <p className="mt-6 text-center text-xs text-muted">Saved result · Viewing, copying, and exporting do not call the AI provider.</p>
  </div>;
}
