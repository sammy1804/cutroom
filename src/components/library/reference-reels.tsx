const REELS = [
  { file: "halden-ad-9x16.mp4", title: "Sample ad · Halden Coffee", detail: "15–20s vertical ad built only from library components", ratio: "aspect-[9/16]" },
  { file: "captions-pack-9x16.mp4", title: "Caption styles", detail: "Word pop, karaoke, serif keyword, two speakers", ratio: "aspect-[9/16]" },
  { file: "library-reel-16x9.mp4", title: "Animation library reel", detail: "Text, image, object, background, 3D and components", ratio: "aspect-video" },
  { file: "transitions-reel-16x9.mp4", title: "Transitions reel", detail: "Twelve transitions between two shots", ratio: "aspect-video" },
] as const;

/** Rendered with @remotion/renderer from src/remotion (pnpm render:reels). */
export function ReferenceReels() {
  return (
    <section className="space-y-4" aria-labelledby="reels-heading">
      <div className="space-y-1">
        <h2 id="reels-heading" className="text-xl font-semibold">
          Reference reels
        </h2>
        <p className="text-base text-muted-foreground">Rendered from these presets with Remotion: what the editor will produce from a creative spec.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[repeat(2,minmax(0,0.55fr))_repeat(2,minmax(0,1fr))]">
        {REELS.map((r) => (
          <figure key={r.file} className="space-y-2">
            <video
              src={`/reference-videos/${r.file}`}
              controls
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`${r.title}: ${r.detail}`}
              className={`${r.ratio} max-h-[520px] w-full rounded-lg bg-black object-contain shadow-card`}
            />
            <figcaption>
              <span className="block text-[15px] font-medium">{r.title}</span>
              <span className="block text-sm text-muted-foreground">{r.detail}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
