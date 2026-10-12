import { KeyRound } from "lucide-react";
import { isClaudeConfigured } from "@/server/ai/claude";

/** Notion-style callout shown wherever an AI feature lives, until ANTHROPIC_API_KEY is set. */
export function ClaudeNotice() {
  if (isClaudeConfigured()) return null;
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3.5 text-[15px]">
      <KeyRound className="mt-0.5 size-5 shrink-0 text-tally" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium">Connect Claude to turn this on</p>
        <p className="text-muted-foreground">
          Add <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[13px]">ANTHROPIC_API_KEY</code> to{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[13px]">.env.local</code> and save. The server picks it up automatically.
        </p>
      </div>
    </div>
  );
}
