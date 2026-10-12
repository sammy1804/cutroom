"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/w/${slug}/settings`;
  const groups = [
    {
      label: "Workspace",
      items: [
        { href: base, label: "General" },
        { href: `${base}/members`, label: "Members" },
        { href: `${base}/providers`, label: "Providers" },
        { href: `${base}/sources`, label: "Sources" },
        { href: `${base}/activity`, label: "Activity" },
      ],
    },
    { label: "You", items: [{ href: `${base}/account`, label: "Account" }] },
  ];
  return (
    <nav className="flex gap-6 overflow-x-auto md:flex-col md:gap-5" aria-label="Settings">
      {groups.map((group) => (
        <div key={group.label} className="flex shrink-0 gap-1 md:flex-col">
          <span className="label-meta hidden px-2 pb-1 md:block">{group.label}</span>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
