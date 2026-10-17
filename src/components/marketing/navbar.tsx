"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/ui/logo";
import { ActionLink } from "@/components/ui/action-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

const links = [{ href: "#capabilities", label: "Capabilities" }, { href: "#process", label: "How it works" }, { href: "#preview", label: "A closer look" }];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-muted md:flex">
          {/* Keep same-document navigation native for every section, including repeated hashes. */}
          {links.map(link => <a key={link.href} href={link.href} className="transition-colors hover:text-accent">{link.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ActionLink href="/workspace" className="hidden min-h-10 py-2 sm:inline-flex">Open workspace <ArrowUpRight size={16} aria-hidden="true" /></ActionLink>
          <Button variant="ghost" className="px-3 md:hidden" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
        </div>
      </Container>
      {open && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-border bg-background px-gutter pb-6 md:hidden">
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="block py-3 text-sm">{link.label}</a>)}
        <ActionLink href="/workspace" onClick={() => setOpen(false)} className="mt-2 w-full">Open workspace <ArrowUpRight size={16} aria-hidden="true" /></ActionLink>
      </nav>}
    </header>
  );
}
