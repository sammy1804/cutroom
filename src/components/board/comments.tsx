"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, MessageCircle, RotateCcw, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addCommentAction, deleteCommentAction, resolveCommentAction } from "@/server/actions/board";
import type { BoardDoc } from "@/lib/board";
import type { CommentView } from "@/server/services/board";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Thread {
  root: CommentView;
  replies: CommentView[];
}

export function threadsOf(comments: CommentView[]): Thread[] {
  const roots = comments.filter((c) => !c.threadId);
  return roots.map((root) => ({ root, replies: comments.filter((c) => c.threadId === root.id) }));
}

/** Where a thread sits on the board: frame-relative threads move with their frame. */
export function threadPoint(board: BoardDoc, c: Pick<CommentView, "frameId" | "x" | "y">) {
  const f = c.frameId ? board.frames.find((x) => x.id === c.frameId) : null;
  return f ? { x: f.x + c.x, y: f.y + c.y } : { x: c.x, y: c.y };
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

export function CommentPin({ thread, active, onOpen, zoom }: { thread: Thread; active: boolean; onOpen: () => void; zoom: number }) {
  const count = 1 + thread.replies.length;
  return (
    <button
      data-board-node
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      aria-label={`Comment by ${thread.root.authorName}: ${thread.root.body}. ${count} message${count > 1 ? "s" : ""}.`}
      className={cn(
        "absolute flex size-8 origin-bottom-left -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-background text-[13px] font-semibold text-white shadow-md transition-transform hover:scale-110",
        thread.root.resolved ? "bg-muted-foreground/60" : "bg-tally",
        active && "scale-110 ring-2 ring-tally ring-offset-2",
      )}
      style={{ transform: `translateY(-100%) scale(${1 / zoom})` }}
    >
      {initial(thread.root.authorName)}
      {count > 1 && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground px-1 text-[10px] text-background">{count}</span>}
    </button>
  );
}

/** An open thread, or a new comment being written (when `thread` is null). */
export function ThreadCard({
  slug,
  projectId,
  thread,
  anchor,
  me,
  canModerate,
  onSaved,
  onDeleted,
  onClose,
  style,
}: {
  slug: string;
  projectId: string;
  thread: Thread | null;
  anchor: { frameId: string | null; x: number; y: number } | null;
  me: string;
  canModerate: boolean;
  onSaved: (c: CommentView) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await addCommentAction(slug, projectId, thread ? { body: text, threadId: thread.root.id } : { body: text, ...anchor! });
      if (!res.ok) return void toast.error(res.message);
      setText("");
      onSaved(res.data);
      if (thread) onSaved({ ...thread.root, resolved: false });
    });
  const resolve = (resolved: boolean) =>
    start(async () => {
      const res = await resolveCommentAction(slug, projectId, thread!.root.id, resolved);
      if (!res.ok) return void toast.error(res.message);
      onSaved({ ...thread!.root, resolved });
      if (resolved) onClose();
    });
  const remove = (c: CommentView) =>
    start(async () => {
      const res = await deleteCommentAction(slug, projectId, c.id);
      if (!res.ok) return void toast.error(res.message);
      onDeleted(c.id);
      if (!c.threadId) onClose();
    });

  const messages = thread ? [thread.root, ...thread.replies] : [];
  return (
    <div
      data-board-node
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={thread ? "Comment thread" : "New comment"}
      className="absolute z-40 w-[300px] rounded-xl bg-card shadow-xl ring-1 ring-black/10"
      style={style}
    >
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <MessageCircle className="size-4 text-muted-foreground" aria-hidden />
        <p className="flex-1 text-[14px] font-semibold">{thread ? (thread.root.resolved ? "Resolved" : "Comment") : "New comment"}</p>
        {thread && (
          <Button variant="ghost" size="icon-sm" onClick={() => resolve(!thread.root.resolved)} disabled={pending} aria-label={thread.root.resolved ? "Re-open thread" : "Resolve thread"}>
            {thread.root.resolved ? <RotateCcw /> : <Check />}
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      {messages.length > 0 && (
        <ul className="max-h-64 space-y-3 overflow-y-auto px-3 py-3">
          {messages.map((m) => (
            <li key={m.id} className="group space-y-0.5">
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">{initial(m.authorName)}</span>
                <span className="font-medium text-foreground">{m.authorName}</span>
                <span>{relativeTime(new Date(m.createdAt))}</span>
                {(m.authorId === me || canModerate) && (
                  <button onClick={() => remove(m)} aria-label="Delete comment" className="ml-auto rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-hover focus-visible:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </p>
              <p className="pl-6 text-[14px] whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-1.5 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send();
        }}
      >
        <label htmlFor="comment-text" className="sr-only">
          {thread ? "Reply" : "Comment"}
        </label>
        <textarea
          id="comment-text"
          autoFocus
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (text.trim()) send();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder={thread ? "Reply…" : "Say what you think… (⌘↵ to send)"}
          className="min-h-0 flex-1 resize-none rounded-md border bg-background px-2 py-1.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-tally"
        />
        <Button type="submit" size="icon-sm" disabled={pending || !text.trim()} aria-label="Send">
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}

/** Side panel list of threads; clicking one jumps the board to it. */
export function CommentsPanel({ threads, onJump }: { threads: Thread[]; onJump: (t: Thread) => void }) {
  const [showResolved, setShowResolved] = useState(false);
  const list = threads.filter((t) => showResolved || !t.root.resolved);
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{threads.filter((t) => !t.root.resolved).length} open</p>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="accent-[var(--tally)]" />
          Show resolved
        </label>
      </div>
      {list.length === 0 ? (
        <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground shadow-card">No comments yet. Press C, or use Comment in the toolbar, then click anywhere on the board.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.root.id}>
              <button onClick={() => onJump(t)} className={cn("w-full rounded-lg bg-card p-3 text-left shadow-card hover:bg-hover", t.root.resolved && "opacity-60")}>
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">{t.root.authorName}</span> · {relativeTime(new Date(t.root.createdAt))}
                  {t.replies.length > 0 && ` · ${t.replies.length} repl${t.replies.length > 1 ? "ies" : "y"}`}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[14px]">{t.root.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
