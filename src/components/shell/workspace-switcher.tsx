"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_META, primaryRole } from "@/lib/permissions";
import { initials } from "@/lib/format";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
}

function WorkspaceAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-[12px] font-semibold text-background">
      {initials(name)}
    </span>
  );
}

export function WorkspaceSwitcher({ current, workspaces }: { current: WorkspaceSummary; workspaces: WorkspaceSummary[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-12 w-full items-center gap-3 rounded-md px-2.5 text-left hover:bg-sidebar-accent focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent">
        <WorkspaceAvatar name={current.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{current.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{ROLE_META[primaryRole(current.role)].label}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        <DropdownMenuLabel className="label-meta">Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={`/w/${w.slug}`} className="gap-2.5">
              <WorkspaceAvatar name={w.name} />
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === current.id && <Check className="size-3.5" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed">
              <Plus className="size-3.5" />
            </span>
            New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
