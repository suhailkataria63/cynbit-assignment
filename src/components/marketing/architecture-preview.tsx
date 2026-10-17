import { ArrowDown, Check, Layers2, MessageSquare, Network, Sparkles } from "lucide-react";

export function ArchitecturePreview() {
  return (
    <div className="architecture-scene relative mx-auto w-full max-w-lg" role="img" aria-label="Illustrative architecture: your business vision becomes a discovery brief, solution architecture, and implementation roadmap.">
      <div className="architecture-decor" aria-hidden="true">
        <div className="architecture-ambient" />
        <div className="architecture-orbit orbit-one" /><div className="architecture-orbit orbit-two" /><div className="architecture-orbit orbit-three" />
        <span className="architecture-particle particle-one" /><span className="architecture-particle particle-two" /><span className="architecture-particle particle-three" /><span className="architecture-particle particle-four" />
      </div>
      <div className="relative z-10 rounded-[1.75rem] border border-illustration-border bg-illustration/90 p-5 shadow-floating sm:p-7">
        <div className="mb-7 flex items-center justify-between border-b border-border/70 pb-5">
          <div className="flex items-center gap-2 text-xs font-medium"><span className="size-2 rounded-full bg-accent" /> THE BIGGER PICTURE</div>
          <span className="rounded-md bg-surface-muted px-2 py-1 text-[10px] text-muted">ILLUSTRATION</span>
        </div>
        <div className="mx-auto flex max-w-64 items-center gap-3 rounded-xl border border-border bg-background p-4"><MessageSquare className="text-accent" size={20} /><div><p className="text-sm font-medium">Your business vision</p><p className="text-xs text-muted">An idea worth exploring.</p></div></div>
        <div className="architecture-connector"><ArrowDown size={15} /></div>
        <div className="rounded-2xl border border-accent/20 bg-accent-soft/60 p-5">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-on-accent"><Sparkles size={19} /></span><div><p className="text-sm font-semibold">Cynbit discovery</p><p className="text-xs text-muted">Clarity before complexity</p></div></div>
          <div className="flex flex-wrap gap-2">{["Context", "Requirements", "Possibilities"].map(item => <span key={item} className="rounded-full border border-accent/10 bg-illustration/80 px-2.5 py-1 text-[10px] text-accent">{item}</span>)}</div>
        </div>
        <div className="architecture-connector"><ArrowDown size={15} /></div>
        <div className="grid grid-cols-2 gap-3">
          {[{ icon: Network, title: "Architecture", detail: "A connected solution" }, { icon: Layers2, title: "Roadmap", detail: "A considered next step" }].map(({ icon: Icon, title, detail }) => <div key={title} className="rounded-xl border border-border p-3.5"><Icon size={19} className="mb-3 text-accent" /><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] text-muted">{detail}</p></div>)}
        </div>
      </div>
      <div className="relative z-20 -mt-4 ml-auto mr-3 flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 shadow-card sm:-mr-4"><span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent"><Check size={12} /></span><span className="text-xs font-medium">From possibility to a plan.</span></div>
    </div>
  );
}
