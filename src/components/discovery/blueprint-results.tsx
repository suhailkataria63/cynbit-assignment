"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Copy, Download, PanelLeftClose, PanelLeftOpen, Sparkles, LayoutDashboard, Lightbulb, Workflow, Route, Target } from "lucide-react";
import { GenerationDetails } from "./generation-details";
import { BlueprintSectionContent } from "./blueprint-section-content";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { blueprintText } from "@/lib/blueprint/presentation";
import type { BlueprintResult } from "@/lib/blueprint/schema";
import { studioSections } from "./studio-content";
import "./blueprint-studio.css";

const sectionIcons = [LayoutDashboard, Lightbulb, Workflow, Route, Target];

function headerOffset() {
  return (document.querySelector("header")?.getBoundingClientRect().height ?? 80) + (document.querySelector(".studio-mobile-nav")?.getBoundingClientRect().height ?? 0) + 24;
}

export function BlueprintResults({ result, onBack }: { result: BlueprintResult; onBack?: () => void }) {
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("overview");
  const root = useRef<HTMLDivElement>(null);
  const sections = studioSections;
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const headerHeight = `${document.querySelector("header")?.getBoundingClientRect().height ?? 80}px`;
      if (root.current && root.current.style.getPropertyValue("--studio-header-height") !== headerHeight) root.current.style.setProperty("--studio-header-height", headerHeight);
      const nodes = root.current?.querySelectorAll<HTMLElement>("[data-studio-section]");
      let current = "overview";
      const threshold = headerOffset() + 32;
      nodes?.forEach(node => { if (node.getBoundingClientRect().top <= threshold) current = node.dataset.studioSection!; });
      if (nodes?.length && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = nodes[nodes.length - 1].dataset.studioSection!;
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    const header = document.querySelector("header");
    if (header) observer.observe(header);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [result]);
  function navigate(id: string) {
    const section = document.getElementById(`blueprint-${id}`);
    if (!section) return;
    // Settle disclosure sizing before measuring. Browsers do not consistently
    // expose ::details-content transitions through getAnimations().
    root.current?.classList.add("studio-measuring");
    const top = window.scrollY + section.getBoundingClientRect().top - headerOffset();
    root.current?.classList.remove("studio-measuring");
    setActive(id);
    // One scroll owner, including repeated selections; no router/hash interaction.
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
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
  return <div ref={root} className="blueprint-studio">
    <div className="studio-actions mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles size={18} aria-hidden="true" /></span><div><p className="text-sm font-semibold">Blueprint Studio</p><p className="mt-0.5 text-[10px] text-muted">Saved report · <time dateTime={result.metadata.generatedAt}>{new Date(result.metadata.generatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></p></div></div>
      <div className="flex flex-wrap gap-2">{onBack && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to Questionnaire</Button>}<Button variant="secondary" size="sm" onClick={() => void copy()}><Copy aria-hidden="true" /> Copy blueprint</Button><Button size="sm" onClick={download}><Download aria-hidden="true" /> Export JSON</Button></div>
    </div>
    <p className="studio-notice text-sm text-accent" role="status">{notice}</p>
    <div className="studio-mobile-nav"><label htmlFor="blueprint-section-select" className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted">In this blueprint</label><select id="blueprint-section-select" value={active} onChange={event => navigate(event.target.value)} className="w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground">{sections.map((section, i) => <option key={section.id} value={section.id}>{String(i + 1).padStart(2, "0")} · {section.title}</option>)}</select></div>
    <div className="studio-layout" data-collapsed={collapsed}>
      <aside className="studio-sidebar" aria-label="Blueprint contents">
        <div className="mb-5 flex items-center justify-between gap-2 px-2"><span className="studio-nav-label text-[10px] font-medium uppercase tracking-widest text-muted" aria-hidden={collapsed}>The blueprint</span><Button variant="ghost" size="sm" className="studio-collapse size-10 shrink-0 p-0" aria-label={collapsed ? "Expand blueprint navigation" : "Collapse blueprint navigation"} aria-expanded={!collapsed} aria-controls="blueprint-navigation" onClick={() => setCollapsed(value => !value)}>{collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</Button></div>
        <nav id="blueprint-navigation" aria-label="Blueprint sections"><ol className="space-y-1">{sections.map((section, i) => { const Icon = sectionIcons[i]; return <li key={section.id}><a href={`#blueprint-${section.id}`} title={section.title} aria-label={`${String(i + 1).padStart(2, "0")} ${section.title}`} aria-current={active === section.id ? "location" : undefined} className="studio-nav-link" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(section.id); }}><Icon className="studio-nav-icon" size={18} aria-hidden="true" /><span className="studio-nav-number">{String(i + 1).padStart(2, "0")}</span><span className="studio-nav-label" aria-hidden={collapsed}>{section.title}</span></a></li>; })}</ol></nav>
        <Link href="/" className="studio-home-link mt-7 flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs text-muted hover:text-accent" aria-label="Back to home"><ArrowUpRight size={14} className="shrink-0" aria-hidden="true" /><span className="studio-nav-label" aria-hidden={collapsed}>Back to home</span></Link>
      </aside>
      <div className="studio-document min-w-0">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/35 p-4"><Sparkles size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><p className="text-xs font-semibold text-accent">AI-generated · Review before implementation</p><p className="mt-1 max-w-reading studio-secondary">This blueprint is a starting point, not a validated specification or a guarantee of accuracy, cost, compliance, or outcomes. Check its assumptions and missing information with your team.</p></div></div>
        {sections.map((section, i) => <section key={section.id} id={`blueprint-${section.id}`} data-studio-section={section.id} aria-labelledby={`blueprint-heading-${section.id}`} className={`studio-section ${section.id === "overview" ? "studio-introduction" : ""}`}><Reveal><div className="studio-section-heading"><span className="studio-section-number">{String(i + 1).padStart(2, "0")}</span><h2 id={`blueprint-heading-${section.id}`}>{section.title}</h2></div><div className="studio-section-body"><BlueprintSectionContent id={section.id} blueprint={result.blueprint} lines={[]} /></div></Reveal></section>)}
        <div className="mt-10"><GenerationDetails details={result.metadata} /></div>
        <p className="mt-6 text-center text-xs text-muted">Saved result · Viewing, copying, and exporting do not call the AI provider.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs text-muted hover:text-accent lg:hidden"><ArrowLeft size={14} aria-hidden="true" /> Back to home</Link>
      </div>
    </div>
  </div>;
}
