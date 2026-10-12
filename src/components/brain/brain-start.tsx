"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startBrainAction } from "@/server/actions/brain";

/** "I have an idea": starts a Brain conversation. */
export function BrainStart({ slug, aiEnabled, autoFocus = false, placeholder }: { slug: string; aiEnabled: boolean; autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const res = await startBrainAction(slug, idea);
      if (!res.ok) return void toast.error(res.message);
      router.push(`/w/${slug}/brain/${res.data.threadId}`);
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl bg-card p-2 shadow-card"
    >
      <label htmlFor="brain-idea" className="sr-only">
        Describe your idea
      </label>
      <textarea
        id="brain-idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && idea.trim().length >= 8) submit();
        }}
        rows={3}
        autoFocus={autoFocus}
        disabled={!aiEnabled || pending}
        placeholder={aiEnabled ? (placeholder ?? "I want to make a campaign about how construction waste can become a resource…") : "Connect Claude to brainstorm (ANTHROPIC_API_KEY)"}
        className="w-full resize-none bg-transparent px-3 py-2.5 text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <span className="text-[13px] text-muted-foreground">{pending ? "Thinking through directions… this takes about half a minute." : "⌘↵ to send"}</span>
        <Button type="submit" disabled={!aiEnabled || pending || idea.trim().length < 8}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Brainstorm
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </div>
    </form>
  );
}
