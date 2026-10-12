"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Draft } from "@/lib/types";

const X_LIMIT = 280;

// Editable draft text. Autosaves shortly after typing stops, on blur, and on unmount.
export default function DraftBody({ draft, onSave }: { draft: Draft; onSave: (body: string) => Promise<boolean> }) {
  const [value, setValue] = useState(draft.body);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const saved = useRef(draft.body);
  const save = useRef(onSave);
  save.current = onSave;

  // Grow the textarea to fit its text, and re-fit when its width changes.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const body = latest.current;
    if (body === saved.current || !body.trim()) return;
    setState("saving");
    const ok = await save.current(body);
    if (ok) {
      saved.current = body;
      setState("saved");
    } else {
      setState("idle");
    }
  }

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (latest.current !== saved.current && latest.current.trim()) void save.current(latest.current);
      }
    };
  }, []);

  const isX = draft.platform === "x";
  const over = isX && value.length > X_LIMIT;

  return (
    <div>
      <textarea
        ref={area}
        className="field draft-text"
        value={value}
        aria-label={`${isX ? "X" : "LinkedIn"} draft`}
        onChange={(e) => {
          setValue(e.target.value);
          latest.current = e.target.value;
          setState("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 800);
        }}
        onBlur={flush}
      />
      <div className="draft-meta">
        {isX ? (
          <span className={over ? "warn" : ""}>
            {value.length} / {X_LIMIT}
            {over ? " – too long" : ""}
          </span>
        ) : (
          <span>{value.trim().split(/\s+/).filter(Boolean).length} words</span>
        )}
        <span>{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
      </div>
    </div>
  );
}
