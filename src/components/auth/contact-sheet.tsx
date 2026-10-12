import { cn } from "@/lib/utils";

/**
 * Decorative panel for the auth screens: a contact sheet of deliverable frames
 * in the formats Cutroom produces, drawn with CSS only. Frames share a row
 * height so mixed aspect ratios line up like a real sheet.
 */
const ROWS = [
  [
    { ratio: "9:16", aspect: "9 / 16", label: "REEL_HOOK_v3", tc: "00:00:02:14", tone: "from-[oklch(0.44_0.07_55)] to-[oklch(0.22_0.02_40)]", playing: true },
    { ratio: "1:1", aspect: "1", label: "FEED_STATIC_02", tc: "STILL", tone: "from-[oklch(0.38_0.04_190)] to-[oklch(0.21_0.01_200)]" },
    { ratio: "4:5", aspect: "4 / 5", label: "META_AD_B", tc: "00:00:06:00", tone: "from-[oklch(0.36_0.03_260)] to-[oklch(0.2_0.01_260)]" },
  ],
  [
    { ratio: "16:9", aspect: "16 / 9", label: "YT_PREROLL_15S", tc: "00:00:15:00", tone: "from-[oklch(0.42_0.05_75)] to-[oklch(0.2_0.01_60)]" },
    { ratio: "9:16", aspect: "9 / 16", label: "TT_UGC_CUT_A", tc: "00:00:21:08", tone: "from-[oklch(0.34_0.04_150)] to-[oklch(0.19_0.01_150)]" },
  ],
] as const;

export function ContactSheet() {
  return (
    <div className="absolute inset-0 flex flex-col justify-between gap-8 p-10 xl:p-14">
      <div className="flex items-center justify-between">
        <span className="label-meta">Contact sheet · Spring launch</span>
        <span className="label-meta flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-tally motion-reduce:animate-none" /> REC
        </span>
      </div>

      <div className="flex min-h-0 flex-col gap-6">
        {ROWS.map((row, r) => (
          <div key={r} className="flex items-start gap-4 [--frame-h:clamp(120px,24vh,230px)] xl:gap-5">
            {row.map((frame) => (
              <figure key={frame.label} className="flex shrink-0 flex-col gap-2" style={{ width: `calc(var(--frame-h) * (${frame.aspect}))` }}>
                <div
                  className={cn(
                    "relative h-[var(--frame-h)] overflow-hidden rounded-md border border-white/5 bg-gradient-to-br shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]",
                    frame.tone,
                  )}
                >
                  <div className="absolute inset-[8%] rounded-[3px] border border-dashed border-white/10" />
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/[0.05]" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/[0.05]" />
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/[0.05]" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/[0.05]" />
                  <span className="absolute top-2 left-2 rounded-sm bg-black/40 px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-white/70">
                    {frame.ratio}
                  </span>
                  {"playing" in frame && (
                    <span className="absolute right-2 bottom-2 left-2 h-0.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full w-2/5 rounded-full bg-tally" />
                    </span>
                  )}
                </div>
                <figcaption className="flex justify-between gap-3 font-mono text-[12px] tracking-wide text-muted-foreground">
                  <span className="truncate">{frame.label}</span>
                  <span className="tabular shrink-0">{frame.tc}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>

      <blockquote className="max-w-sm space-y-2">
        <p className="text-lg leading-snug font-medium tracking-tight text-foreground/90">
          From brief to final cut, every deliverable in one place.
        </p>
        <footer className="label-meta">Brief · Research · Script · Generate · Edit · Render</footer>
      </blockquote>
    </div>
  );
}
