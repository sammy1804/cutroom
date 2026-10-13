"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, Compass, House, Library, Menu, PenLine, Plus, Settings, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ProjectSwatch } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CommandBar } from "./command-bar";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher, type WorkspaceSummary } from "./workspace-switcher";

export interface ShellProps {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: { name: string; email: string; image: string | null };
  pinnedProjects: { id: string; name: string; color: string }[];
  canCreateProject: boolean;
  aiEnabled: boolean;
  children: React.ReactNode;
}

export function AppShell(props: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const openCommand = () => {
    setMobileOpen(false);
    setCommandOpen(true);
  };

  // The project board is a focus-mode studio with its own chrome.
  if (/\/projects\/[^/]+\/board$/.test(pathname)) {
    return (
      <>
        {props.children}
        <CommandBar slug={props.workspace.slug} open={commandOpen} onOpenChange={setCommandOpen} aiEnabled={props.aiEnabled} />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 bg-sidebar md:flex">
        <SidebarContent {...props} onCommand={openCommand} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[280px] bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent {...props} onCommand={openCommand} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon-lg" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <LogoMark />
          <span className="flex-1 truncate font-medium">{props.workspace.name}</span>
          <Button variant="ghost" size="icon-lg" onClick={openCommand} aria-label="Ask Cutroom">
            <Sparkles className="text-tally" />
          </Button>
        </header>
        <main className="flex-1">{props.children}</main>
        <CommandBar slug={props.workspace.slug} open={commandOpen} onOpenChange={setCommandOpen} aiEnabled={props.aiEnabled} />
      </div>
    </div>
  );
}

function SidebarContent({ workspace, workspaces, user, pinnedProjects, canCreateProject, onCommand }: ShellProps & { onCommand: () => void }) {
  const pathname = usePathname();
  const base = `/w/${workspace.slug}`;

  const nav = [
    { href: base, label: "Home", icon: House, active: pathname === base },
    { href: `${base}/explore`, label: "Explore", icon: Compass, active: pathname.startsWith(`${base}/explore`) },
    { href: `${base}/library`, label: "Library", icon: Library, active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/memory`) },
    { href: `${base}/projects`, label: "Create", icon: PenLine, active: pathname.startsWith(`${base}/projects`) },
    { href: `${base}/brain`, label: "Brain", icon: Brain, active: pathname.startsWith(`${base}/brain`) },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="p-2.5">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>

      <div className="px-2.5 pb-2">
        <button
          onClick={onCommand}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg border bg-background/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <Sparkles className="size-4 text-tally" />
          <span className="flex-1">Ask Cutroom</span>
          <kbd className="rounded border px-1.5 font-mono text-[11px]">⌘K</kbd>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5 pt-1" aria-label="Workspace">
        {nav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      <div className="mt-7 px-2.5">
        <div className="flex items-center justify-between px-2.5 pb-1.5">
          <span className="text-[13px] font-semibold text-muted-foreground">Recent projects</span>
          {canCreateProject && (
            <Link
              href={`${base}/projects/new`}
              aria-label="New project"
              className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plus className="size-4" />
            </Link>
          )}
        </div>
        {pinnedProjects.length === 0 ? (
          <p className="px-2.5 py-1 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pinnedProjects.map((p) => {
              const href = `${base}/projects/${p.id}`;
              const active = pathname.startsWith(href);
              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-md px-2.5 text-[15px] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      active && "bg-sidebar-accent font-medium text-sidebar-foreground",
                    )}
                  >
                    <ProjectSwatch color={p.color} className="size-3" />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 p-2.5">
        <NavItem
          href={`${base}/settings`}
          label="Settings"
          icon={Settings}
          active={pathname.startsWith(`${base}/settings`)}
        />
        <UserMenu user={user} />
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-2.5 text-[15px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-foreground",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
      {label}
    </Link>
  );
}
