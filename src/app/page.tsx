import { ArrowRight, ArrowUpRight, Check, Compass, GitBranch, Layers2, MessageSquareText, Route, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Navbar } from "@/components/marketing/navbar";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { ArchitecturePreview } from "@/components/marketing/architecture-preview";
import { ActionLink } from "@/components/ui/action-link";
import { Logo } from "@/components/ui/logo";
import { Reveal } from "@/components/ui/reveal";

const capabilities = [
  { icon: MessageSquareText, title: "Intelligent Discovery", description: "Start with a conversation. Bring your goals, challenges, and ideas into focus before choosing a solution.", number: "01" },
  { icon: Sparkles, title: "AI Recommendations", description: "Explore where AI could help, with suggested approaches grounded in your business context.", number: "02" },
  { icon: GitBranch, title: "Solution Architecture", description: "Connect the pieces. See how interfaces, workflows, and data could work together.", number: "03" },
  { icon: Route, title: "Implementation Roadmap", description: "Move forward with direction. Break the journey into a practical, phased starting plan.", number: "04" },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Section className="hero-section overflow-hidden pb-16 pt-16 lg:pb-24 lg:pt-24">
          <Container>
            <div className="grid items-center gap-16 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
              <Reveal>
                <p className="eyebrow mb-7"><span className="size-1.5 rounded-full bg-accent" /> CYNBIT AI SOLUTIONS ARCHITECT</p>
                <h1 className="max-w-3xl text-[clamp(3.5rem,6vw,6rem)] leading-[1.02] tracking-[-0.045em]">Your vision.<br />Our intelligence.<br /><span className="text-accent">Built for what’s next.</span></h1>
                <p className="mt-7 max-w-lg text-base leading-relaxed text-muted sm:text-lg">Turn your business challenges into a clearer technology direction. Explore AI-powered discovery, thoughtful recommendations, and the shape of your next solution.</p>
                <div className="mt-9 flex flex-wrap gap-3"><ActionLink href="/workspace">Start AI Discovery <ArrowUpRight size={17} aria-hidden="true" /></ActionLink><ActionLink href="#capabilities" variant="secondary">Explore Capabilities <ArrowRight size={16} aria-hidden="true" /></ActionLink></div>
                <p className="mt-5 flex items-center gap-2 text-xs text-muted"><span className="size-1.5 rounded-full bg-accent/60" /> Interactive PoC · Guided discovery · No sign-up</p>
              </Reveal>
              <Reveal className="relative px-2 sm:px-8 lg:px-0"><ArchitecturePreview /></Reveal>
            </div>
            <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-6 text-xs text-muted lg:mt-24"><p>BUSINESS FIRST. TECHNOLOGY WITH PURPOSE.</p><div className="flex flex-wrap gap-6"><span className="flex items-center gap-2"><Compass size={14} aria-hidden="true" /> Discover the right problem</span><span className="flex items-center gap-2"><Layers2 size={14} aria-hidden="true" /> Shape the right solution</span></div></div>
          </Container>
        </Section>
        <Section id="capabilities" className="border-y border-border bg-surface/60">
          <Container>
            <Reveal><p className="eyebrow">THE POSSIBILITIES, CONNECTED</p><div className="mb-12 mt-4 grid gap-5 md:grid-cols-2 md:items-end"><h2 className="max-w-xl">A little clarity.<br />A whole new direction.</h2><p className="max-w-md text-base text-muted md:justify-self-end">From the first question to a structured blueprint, give your ideas the space and direction they deserve.</p></div></Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map(({ icon: Icon, title, description, number }) => <Reveal key={title} className="h-full"><article className="capability-card surface-card h-full p-6"><div className="mb-9 flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-accent-soft/70 text-accent"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span><span className="text-xs text-muted/60">{number}</span></div><h3 className="font-sans text-base font-semibold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{description}</p></article></Reveal>)}</div>
          </Container>
        </Section>
        <Section id="process">
          <Container>
            <Reveal className="mb-14 text-center"><p className="eyebrow justify-center">LESS GUESSWORK. MORE DIRECTION.</p><h2 className="mt-4">Big ideas. Three simple steps.</h2></Reveal>
            <div className="grid gap-10 md:grid-cols-3 md:gap-12">{[{ title: "Describe", text: "Tell us what you’re working toward. A business challenge, an ambitious idea, or a process that needs a rethink." }, { title: "Explore", text: "Work through the questions that matter. Clarify your needs, constraints, and where technology could help." }, { title: "Generate Blueprint", text: "Bring it all together in a starting architecture and phased roadmap to discuss with your team." }].map((step, i) => <Reveal key={step.title} className="process-step-hover"><article className="process-step"><div className="mb-6 flex items-center gap-4"><span className="process-step-number grid size-10 shrink-0 place-items-center rounded-full border text-xs font-medium text-accent">0{i + 1}</span><span className="h-px w-full bg-border" /></div><h3 className="font-sans text-xl font-medium">{step.title}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{step.text}</p></article></Reveal>)}</div>
          </Container>
        </Section>
        <Section id="preview" className="border-y border-border bg-preview">
          <Container className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <Reveal><p className="eyebrow">A CONVERSATION WITH DIRECTION</p><h2 className="mt-5">A better starting point<br />starts with you.</h2><p className="mt-6 max-w-md text-base text-muted">You don’t need a technical specification. Start with what matters to your business, then explore what a solution could look like.</p><ul className="my-7 space-y-3 text-sm">{["Your context, before the technology", "Clear recommendations and trade-offs", "A blueprint to build the conversation around"].map(text => <li key={text} className="flex items-center gap-3"><Check size={16} className="text-accent" aria-hidden="true" />{text}</li>)}</ul><ActionLink href="/workspace" variant="secondary">Start guided discovery <ArrowUpRight size={16} aria-hidden="true" /></ActionLink></Reveal>
            <Reveal className="preview-scene"><div className="preview-decor" aria-hidden="true"><div className="architecture-ambient" /></div><div className="preview-card overflow-hidden rounded-3xl border border-border bg-surface"><div className="flex items-center justify-between border-b border-border px-6 py-4"><span className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-accent" aria-hidden="true" /> Discovery workspace</span><span className="demo-badge">Illustrative demo</span></div><div className="space-y-6 p-5 sm:p-8"><div className="ml-8 rounded-2xl rounded-tr-sm bg-accent-soft p-4 text-sm">We want to make customer support faster, without losing the human touch.</div><div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent"><Sparkles size={15} aria-hidden="true" /></span><div><p className="mb-2 text-xs font-semibold">Cynbit <span className="ml-2 font-normal text-muted">Example response</span></p><p className="text-sm text-muted">A useful starting point could be an assisted support workflow, with your team in control.</p><div className="mt-4 space-y-2">{["Knowledge search grounded in your help content", "Suggested replies for agents to review", "Human handoff for complex requests"].map((text, i) => <div key={text} className="preview-example-row flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-xs"><span className="preview-row-highlight" aria-hidden="true" /><span className="font-medium text-accent">0{i + 1}</span>{text}</div>)}</div><p className="mt-4 text-xs text-muted">What support tools does your team use today?</p></div></div></div><div className="border-t border-border bg-background/70 px-6 py-3 text-[11px] text-muted">Illustrative example. Generate a blueprint from your reviewed questionnaire.</div></div></Reveal>
          </Container>
        </Section>
        <Section><Container><Reveal><SpotlightCard className="relative overflow-hidden rounded-[2rem] bg-cta px-6 py-16 text-center text-on-cta sm:px-12"><p className="eyebrow justify-center text-on-cta/65">YOUR NEXT CHAPTER STARTS HERE</p><h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2.75rem,5vw,4.5rem)]">Let’s give your vision<br />some direction.</h2><p className="mx-auto mb-8 mt-5 max-w-lg text-sm text-on-cta/75">Bring the challenge. Explore the possibilities. Leave with a starting point.</p><ActionLink href="/workspace" variant="secondary" className="border-cta-button bg-cta-button text-cta-button-text hover:bg-cta-button/90">Start AI Discovery <ArrowUpRight size={16} aria-hidden="true" /></ActionLink><p className="mt-4 text-xs text-on-cta/60">Guided questionnaire. No account required.</p></SpotlightCard></Reveal></Container></Section>
      </main>
      <footer className="border-t border-border py-8"><Container className="flex flex-wrap items-center justify-between gap-6"><Logo /><p className="text-xs text-muted">AI Solutions Architect · Proof of concept</p><a href="#main-content" className="text-xs text-muted hover:text-accent">Back to top ↑</a></Container></footer>
    </>
  );
}
