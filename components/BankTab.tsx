"use client";

import { useState } from "react";
import { copyText } from "@/lib/client";
import { formatDay } from "@/lib/dates";
import { nextEmptyDay } from "@/lib/schedule";
import type { Draft, Platform } from "@/lib/types";
import DraftBody from "./DraftBody";
import MediaTips from "./MediaTips";
import type { Shared } from "./App";

type Filter = "all" | Platform;

export default function BankTab({ drafts, today, toast, update }: Shared) {
  const [filter, setFilter] = useState<Filter>("all");
  const bank = drafts.filter((d) => d.status === "bank" && (filter === "all" || d.platform === filter));

  return (
    <div className="narrow stack">
      <div className="tabs" role="group" aria-label="Filter by platform">
        {(["all", "x", "linkedin"] as const).map((f) => (
          <button key={f} className="btn tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "x" ? "X" : "LinkedIn"}
          </button>
        ))}
      </div>

      {bank.length === 0 && <p className="muted center">No drafts in the bank. Add a note.</p>}

      {bank.map((d) => (
        <BankCard key={d.id} draft={d} drafts={drafts} today={today} toast={toast} update={update} />
      ))}
    </div>
  );
}

function BankCard({ draft, drafts, today, toast, update }: { draft: Draft } & Shared) {
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(today);

  async function copy() {
    toast((await copyText(draft.body)) ? "Copied" : "Couldn't copy", false);
  }

  async function confirm() {
    if (!date) return;
    if (await update(draft.id, { action: "schedule", date })) toast(`Scheduled for ${formatDay(date)}`);
  }

  return (
    <article className="card stack-sm">
      <div className="card-head">
        <strong>{draft.platform === "x" ? "X" : "LinkedIn"}</strong>
        <span className="muted small">{draft.angle}</span>
      </div>

      <DraftBody draft={draft} onSave={(body) => update(draft.id, { body })} />
      <MediaTips media={draft.media} />

      <div className="actions">
        <button className="btn" onClick={copy}>
          Copy
        </button>
        <button
          className="btn"
          onClick={() => {
            setDate(nextEmptyDay(drafts, draft.platform, today));
            setPicking((p) => !p);
          }}
        >
          Schedule
        </button>
        <button className="btn" onClick={() => update(draft.id, { action: "discard" })}>
          Discard
        </button>
      </div>

      {picking && (
        <div className="actions">
          <input
            type="date"
            className="field date-input"
            aria-label="Schedule date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn btn-primary" onClick={confirm} disabled={!date}>
            Confirm
          </button>
        </div>
      )}
    </article>
  );
}
