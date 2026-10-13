"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyOps, type BoardDoc, type BoardOp } from "@/lib/board";
import type { CommentView } from "@/server/services/board";

export interface Peer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string | null;
}

type Status = "live" | "syncing" | "offline";

const keyOf = (op: BoardOp) =>
  op.t === "frame" ? `frame:${op.frame.id}` : op.t === "link" ? `link:${op.link.id}` : op.t === "item" ? `item:${op.item.id}` : null;

/** Keeps only the latest upsert per entity, so a drag sends one op instead of hundreds. */
function compact(ops: BoardOp[]) {
  const last = new Map<string, number>();
  ops.forEach((op, i) => {
    const k = keyOf(op);
    if (k) last.set(k, i);
  });
  return ops.filter((op, i) => {
    const k = keyOf(op);
    return !k || last.get(k) === i;
  });
}

/**
 * Live board state. Local edits apply instantly (optimistic) and queue as ops;
 * about once a second the queue is sent and every op since our version comes
 * back in server order. The visible board is always "server state + our
 * unsent ops", so everyone converges on the same board.
 */
export function useBoardSync({
  slug,
  projectId,
  initial,
  initialVersion,
  initialComments,
  canEdit,
}: {
  slug: string;
  projectId: string;
  initial: BoardDoc;
  initialVersion: number;
  initialComments: CommentView[];
  canEdit: boolean;
}) {
  const [board, setBoard] = useState(initial);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [comments, setComments] = useState<CommentView[]>(initialComments);
  const [status, setStatus] = useState<Status>("live");
  const [pendingCount, setPendingCount] = useState(0);

  const confirmed = useRef(initial);
  const version = useRef(initialVersion);
  const pending = useRef<BoardOp[]>([]);
  const inflight = useRef(false);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const selection = useRef<string | null>(null);
  const commentsSince = useRef(new Date().toISOString());
  const clientId = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<() => void>(() => {});

  if (!clientId.current && typeof window !== "undefined") clientId.current = crypto.randomUUID();

  const schedule = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => tickRef.current(), ms);
  }, []);

  const tick = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const sending = canEdit ? compact(pending.current) : [];
    pending.current = [];
    setPendingCount(0);
    if (sending.length) setStatus("syncing");
    try {
      const res = await fetch(`/api/board/${projectId}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, clientId: clientId.current, since: version.current, ops: sending, cursor: cursor.current, selection: selection.current, commentsSince: commentsSince.current }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        version: number;
        ops: { version: number; clientId: string; ops: BoardOp[] }[];
        presence: Peer[];
        comments: CommentView[];
        now: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Sync failed");
      confirmed.current = applyOps(confirmed.current, data.ops.flatMap((r) => r.ops));
      version.current = data.version;
      setBoard(applyOps(confirmed.current, pending.current));
      setPeers(data.presence);
      if (data.comments.length) {
        setComments((list) => {
          const map = new Map(list.map((c) => [c.id, c]));
          for (const c of data.comments) {
            if (c.deleted) map.delete(c.id);
            else map.set(c.id, c);
          }
          return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      }
      commentsSince.current = data.now;
      setStatus("live");
    } catch {
      // Put unsent work back in front of anything queued meanwhile, and retry.
      pending.current = [...sending, ...pending.current];
      setPendingCount(pending.current.length);
      setStatus("offline");
    } finally {
      inflight.current = false;
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      schedule(pending.current.length ? 150 : hidden ? 5000 : 1000);
    }
  }, [canEdit, projectId, slug, schedule]);

  useEffect(() => {
    tickRef.current = () => void tick();
  }, [tick]);

  useEffect(() => {
    schedule(300);
    const leave = () => {
      const blob = new Blob([JSON.stringify({ slug, clientId: clientId.current, since: 0, leaving: true })], { type: "application/json" });
      navigator.sendBeacon(`/api/board/${projectId}/sync`, blob);
    };
    const onVisible = () => document.visibilityState === "visible" && schedule(50);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisible);
      leave();
    };
  }, [projectId, slug, schedule]);

  /** Apply ops locally right away and queue them for everyone else. */
  const commit = useCallback(
    (ops: BoardOp[]) => {
      if (!canEdit || !ops.length) return;
      pending.current.push(...ops);
      setPendingCount(pending.current.length);
      setBoard((b) => applyOps(b, ops));
      schedule(150);
    },
    [canEdit, schedule],
  );

  const setCursor = useCallback((c: { x: number; y: number } | null) => {
    cursor.current = c;
  }, []);
  const setSelection = useCallback(
    (id: string | null) => {
      selection.current = id;
      schedule(100);
    },
    [schedule],
  );
  const upsertComment = useCallback((c: CommentView) => setComments((list) => [...list.filter((x) => x.id !== c.id), c]), []);
  const dropComment = useCallback((id: string) => setComments((list) => list.filter((x) => x.id !== id && x.threadId !== id)), []);

  return { board, commit, peers, comments, upsertComment, dropComment, status, saving: pendingCount > 0 || status === "syncing", setCursor, setSelection };
}
