"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/client";
import { addDays, formatDay, formatRange, startOfWeek } from "@/lib/dates";
import { slotFor } from "@/lib/schedule";
import type { Draft, Platform } from "@/lib/types";
import DraftBody from "./DraftBody";
import type { Shared } from "./App";

const PLATFORMS: Platform[] = ["x", "linkedin"];

export default function CalendarTab({ drafts, today, toast, update }: Shared) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [picker, setPicker] = useState<{ day: string; platform: Platform } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const thisWeek = startOfWeek(today);

  return (
    <div className="stack">
      <div className="week-nav">
        <button className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
          ←
        </button>
        <div className="week-title">
          <strong>{formatRange(weekStart)}</strong>
          {weekStart !== thisWeek && (
            <button className="small-link" onClick={() => setWeekStart(thisWeek)}>
              This week
            </button>
          )}
        </div>
        <button className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
          →
        </button>
      </div>

      <div className="week">
        {days.map((day) => {
          const slots = PLATFORMS.map((p) => ({ platform: p, draft: slotFor(drafts, day, p) }));
          const overdue = day < today && slots.some((s) => s.draft?.status === "scheduled");
          return (
            <section key={day} className={`card day${day === today ? " day-today" : ""}`}>
              <h2 className="day-title">
                {formatDay(day)}
                {overdue && <span className="dot" role="img" aria-label="Scheduled but not posted" />}
              </h2>
              {slots.map(({ platform, draft }) => (
                <div key={platform} className="slot">
                  <span className="slot-label">{platform === "x" ? "X" : "LinkedIn"}</span>
                  {draft ? (
                    <FilledSlot key={draft.id} draft={draft} toast={toast} update={update} />
                  ) : (
                    <button className="slot-empty" onClick={() => setPicker({ day, platform })}>
                      Pick from bank
                    </button>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {picker && (
        <BankPicker
          drafts={drafts}
          day={picker.day}
          platform={picker.platform}
          onClose={() => setPicker(null)}
          onPick={async (id) => {
            if (await update(id, { action: "schedule", date: picker.day })) {
              setPicker(null);
              toast(`Scheduled for ${formatDay(picker.day)}`);
            }
          }}
        />
      )}
    </div>
  );
}

function FilledSlot({ draft, toast, update }: { draft: Draft } & Pick<Shared, "toast" | "update">) {
  const posted = draft.status === "posted";
  return (
    <div className="stack-sm">
      <DraftBody draft={draft} onSave={(body) => update(draft.id, { body })} />
      <div className="actions">
        <button
          className="btn"
          onClick={async () => toast((await copyText(draft.body)) ? "Copied" : "Couldn't copy")}
        >
          Copy
        </button>
        {posted ? (
          <button className="btn" onClick={() => update(draft.id, { action: "unpost" })}>
            Posted ✓ Undo
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => update(draft.id, { action: "post" })}>
            Mark posted
          </button>
        )}
        <button className="btn" onClick={() => update(draft.id, { action: "unschedule" })}>
          Unschedule
        </button>
      </div>
    </div>
  );
}

function BankPicker({
  drafts,
  day,
  platform,
  onClose,
  onPick,
}: {
  drafts: Draft[];
  day: string;
  platform: Platform;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const options = drafts.filter((d) => d.status === "bank" && d.platform === platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet stack-sm" role="dialog" aria-label="Pick from bank" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <strong>
            {platform === "x" ? "X" : "LinkedIn"} · {formatDay(day)}
          </strong>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        {options.length === 0 && <p className="muted">No {platform === "x" ? "X" : "LinkedIn"} drafts in the bank.</p>}
        {options.map((d) => (
          <article key={d.id} className="card stack-sm">
            <span className="muted small">{d.angle}</span>
            <p className="clamp-5">{d.body}</p>
            <div className="row-end">
              <button className="btn btn-primary" onClick={() => onPick(d.id)}>
                Use
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
