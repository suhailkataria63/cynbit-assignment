import { Fragment, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { textPreview } from "./studio-content";

// Deliberately small Markdown subset; raw HTML and links are plain text, never
// interpreted. React escapes every string. No HTML injection or URL execution.
export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(start, match.index));
    const token = match[0];
    parts.push(token.startsWith("**") || token.startsWith("__") ? <strong key={match.index}>{token.slice(2, -2)}</strong> : token.startsWith("`") ? <code key={match.index}>{token.slice(1, -1)}</code> : <em key={match.index}>{token.slice(1, -1)}</em>);
    start = match.index! + token.length;
  }
  parts.push(text.slice(start));
  return <>{parts}</>;
}

export function ReportText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const bullet = /^\s*[-*+]\s+/.test(lines[i]);
    const ordered = /^\s*\d+[.)]\s+/.test(lines[i]);
    if (bullet || ordered) {
      const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      const items: ReactNode[] = [];
      const index = i;
      while (i < lines.length && pattern.test(lines[i])) { items.push(<li key={i}><InlineText text={lines[i].replace(pattern, "")} /></li>); i++; }
      blocks.push(ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>);
    } else {
      const index = i;
      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) { paragraph.push(lines[i].replace(/^#{1,6}\s+/, "")); i++; }
      blocks.push(<p key={index}>{paragraph.map((line, j) => <Fragment key={j}>{j > 0 && <br />}<InlineText text={line} /></Fragment>)}</p>);
    }
  }
  return <div className={`studio-rich-text ${className}`}>{blocks}</div>;
}

export function CompactText({ text, label = "Full details", limit = 170 }: { text: string; label?: string; limit?: number }) {
  if (text.length <= limit) return <ReportText text={text} />;
  return <div className="studio-compact-copy"><p className="studio-preview"><InlineText text={textPreview(text, limit)} /></p><details className="studio-details studio-text-details"><summary><span>{label}</span><ChevronDown size={14} aria-hidden="true" /></summary><ReportText text={text} /></details></div>;
}
