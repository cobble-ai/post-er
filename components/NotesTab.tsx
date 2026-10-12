"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { Note } from "@/lib/types";

type DraftResult = { status: "drafted"; count: number } | { status: "needs_detail"; noteId: string; question: string };

export default function NotesTab({
  notes,
  toast,
  refresh,
}: {
  notes: Note[];
  toast: (message: string, isError?: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<DraftResult>("/api/draft", { method: "POST", body: { text } });
      setText("");
      toast(res.status === "drafted" ? `${res.count} drafts added to the Bank` : "One quick question first");
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const pending = notes.filter((n) => n.status === "needs_detail" && n.follow_up_question);

  return (
    <div className="narrow stack">
      <div className="stack-sm">
        <textarea
          className="field note-box"
          placeholder="What happened? A number, a failure, a quote, a decision."
          aria-label="Note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <div className="row-end">
          <button className="btn btn-primary" onClick={save} disabled={busy || !text.trim()}>
            {busy ? "Working…" : "Save"}
          </button>
        </div>
      </div>

      {pending.map((n) => (
        <FollowUp key={n.id} note={n} toast={toast} refresh={refresh} />
      ))}

      <section className="stack-sm">
        <h2>Recent notes</h2>
        {notes.length === 0 && <p className="muted">Nothing yet.</p>}
        {notes.slice(0, 15).map((n) => (
          <article key={n.id} className="card note-row">
            <p className="clamp">{n.raw_text}</p>
            <div className="draft-meta">
              <span>{new Date(n.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              <span className={n.status === "needs_detail" ? "badge badge-open" : "badge"}>
                {n.status === "needs_detail" ? "Needs detail" : "Drafted"}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function FollowUp({
  note,
  toast,
  refresh,
}: {
  note: Note;
  toast: (message: string, isError?: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<DraftResult>("/api/draft", { method: "POST", body: { noteId: note.id, answer } });
      if (res.status === "drafted") toast(`${res.count} drafts added to the Bank`);
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
      setBusy(false);
    }
  }

  return (
    <section className="card stack-sm">
      <p className="muted clamp">{note.raw_text}</p>
      <p className="question">{note.follow_up_question}</p>
      <textarea
        className="field answer-box"
        aria-label="Your answer"
        placeholder="Your answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={busy}
      />
      <div className="row-end">
        <button className="btn btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
          {busy ? "Working…" : "Draft it"}
        </button>
      </div>
    </section>
  );
}
