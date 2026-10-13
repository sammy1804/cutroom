import Link from "next/link";
import { cn } from "@/lib/utils";

export const LIBRARY_TABS = [
  { id: "animations", label: "Animations" },
  { id: "compositions", label: "Templates" },
  { id: "assets", label: "My assets" },
  { id: "open", label: "Open library" },
  { id: "free", label: "Free assets" },
  { id: "references", label: "References" },
  { id: "audio", label: "Audio" },
  { id: "memory", label: "Creative memory" },
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number]["id"];

/** Tab strip shared by the Library page and, later, the editor's asset panel. */
export function LibraryTabs({ base, active, counts }: { base: string; active: LibraryTab; counts?: Partial<Record<LibraryTab, number>> }) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Library sections">
      {LIBRARY_TABS.map((t) => (
        <Link
          key={t.id}
          href={t.id === "memory" ? base.replace("/library", "/memory") : `${base}?tab=${t.id}`}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 pb-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground",
            active === t.id && "border-foreground font-medium text-foreground",
          )}
        >
          {t.label}
          {counts?.[t.id] !== undefined && <span className="tabular rounded-full bg-muted px-1.5 font-mono text-xs">{counts[t.id]}</span>}
        </Link>
      ))}
    </nav>
  );
}
