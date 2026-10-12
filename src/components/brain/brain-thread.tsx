"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ExternalLink, Loader2, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { brainFollowUpAction, projectFromDirectionAction } from "@/server/actions/brain";
import type { BrainTurn } from "@/lib/creative-types";
import { DirectionCard } from "./direction-card";

type Action = NonNullable<BrainTurn["action"]>;

export function BrainThreadView({ slug, threadId, turns, projectId, aiEnabled, canCreate }: { slug: string; threadId: string; turns: BrainTurn[]; projectId: string | null; aiEnabled: boolean; canCreate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const follow = (action: Action, directionId?: string, text?: string) => {
    setBusy(`${action}:${directionId ?? ""}`);
    startTransition(async () => {
      const res = await brainFollowUpAction(slug, threadId, action, directionId, text);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      setMessage("");
      router.refresh();
    });
  };

  const makeProject = (directionId: string) => {
    setBusy(`project:${directionId}`);
    startTransition(async () => {
      const res = await projectFromDirectionAction(slug, threadId, directionId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      router.push(`/w/${slug}/projects/${res.data.projectId}`);
    });
  };

  const spin = (key: string) => (busy === key ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className="space-y-10 pb-40">
      <h1 className="text-[28px] leading-tight font-bold sm:text-[34px]">{turns[0]?.text}</h1>
      {projectId && (
        <Link href={`/w/${slug}/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-[15px] text-tally underline-offset-4 hover:underline">
          This became a project <ArrowRight className="size-4" />
        </Link>
      )}

      {turns.slice(1).map((turn) =>
        turn.role === "user" ? (
          <p key={turn.id} className="ml-auto w-fit max-w-[80%] rounded-lg bg-muted px-4 py-2.5 text-[15px]">
            {turn.text}
          </p>
        ) : (
          <section key={turn.id} className="space-y-5" aria-label="Brain reply">
            {turn.text && <p className="max-w-[68ch] text-[17px] leading-relaxed">{turn.text}</p>}
            {turn.insights && turn.insights.length > 0 && (
              <ul className="space-y-3 rounded-lg bg-muted p-5">
                {turn.insights.map((ins) => (
                  <li key={ins.title} className="space-y-0.5 text-[15px]">
                    <p className="font-medium">{ins.title}</p>
                    <p className="leading-relaxed text-muted-foreground">{ins.detail}</p>
                    {ins.source && /^https?:/.test(ins.source) && (
                      <a href={ins.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-tally hover:underline">
                        Source <ExternalLink className="size-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {turn.directions && turn.directions.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {turn.directions.map((d, i) => (
                  <DirectionCard key={d.id} direction={d} index={i}>
                    <Button size="sm" variant="ghost" disabled={!aiEnabled || pending} onClick={() => follow("why", d.id)}>
                      {spin(`why:${d.id}`)}Why?
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!aiEnabled || pending} onClick={() => follow("stronger", d.id)}>
                      {spin(`stronger:${d.id}`)}Make it stronger
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!aiEnabled || pending} onClick={() => follow("research", d.id)}>
                      {spin(`research:${d.id}`)}Research this
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!aiEnabled || pending} onClick={() => follow("references", d.id)}>
                      {spin(`references:${d.id}`)}Find references
                    </Button>
                    {canCreate && (
                      <Button size="sm" className="ml-auto" disabled={pending} onClick={() => makeProject(d.id)}>
                        {spin(`project:${d.id}`)}Start a project <ArrowRight data-icon="inline-end" />
                      </Button>
                    )}
                  </DirectionCard>
                ))}
              </div>
            )}
            {turn.questions && turn.questions.length > 0 && (
              <div className="space-y-1.5">
                <p className="label-meta">Worth deciding</p>
                <ul className="list-disc space-y-1 pl-5 text-[15px]">
                  {turn.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ),
      )}

      {pending && (
        <p className="flex items-center gap-2 text-[15px] text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin text-tally" /> Thinking… research takes up to a minute.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur md:left-[260px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) follow("brainstorm", undefined, message);
          }}
          className="mx-auto flex max-w-[980px] flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:px-12"
        >
          <label htmlFor="brain-message" className="sr-only">
            Reply to Brain
          </label>
          <input
            id="brain-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Push back, add a constraint, ask a question…"
            disabled={!aiEnabled || pending}
            className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-[15px] outline-none focus-visible:border-ring"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!aiEnabled || pending} onClick={() => follow("another")}>
              {spin("another:")}
              <Sparkles data-icon="inline-start" /> Another direction
            </Button>
            <Button type="button" variant="outline" disabled={!aiEnabled || pending} onClick={() => follow("different")}>
              {spin("different:")}
              <Shuffle data-icon="inline-start" /> Something different
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
