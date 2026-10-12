"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { todayISO } from "@/lib/dates";
import { computeStreak } from "@/lib/schedule";
import type { Draft, Note } from "@/lib/types";
import CalendarTab from "./CalendarTab";
import NotesTab from "./NotesTab";
import BankTab from "./BankTab";

type Tab = "calendar" | "notes" | "bank";
const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "notes", label: "Notes" },
  { id: "bank", label: "Bank" },
];

export type DraftAction =
  | { body: string }
  | { action: "schedule"; date: string }
  | { action: "unschedule" | "post" | "unpost" | "discard" };

export type Shared = {
  drafts: Draft[];
  today: string;
  toast: (message: string, isError?: boolean) => void;
  update: (id: string, change: DraftAction) => Promise<boolean>;
};

export default function App() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, error = false) => {
    setMessage({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), error ? 6000 : 3000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [d, n] = await Promise.all([
        api<{ drafts: Draft[] }>("/api/drafts"),
        api<{ notes: Note[] }>("/api/notes"),
      ]);
      setDrafts(d.drafts);
      setNotes(n.notes);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [toast]);

  useEffect(() => {
    setToday(todayISO());
    void refresh();
    // Keep "today" right if the tab stays open past midnight.
    const onVisible = () => document.visibilityState === "visible" && setToday(todayISO());
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const update = useCallback(
    async (id: string, change: DraftAction) => {
      try {
        const { draft } = await api<{ draft: Draft }>(`/api/drafts/${id}`, { method: "PATCH", body: change });
        setDrafts((all) =>
          all
            ? draft.status === "discarded"
              ? all.filter((d) => d.id !== id)
              : all.map((d) => (d.id === id ? draft : d))
            : all,
        );
        return true;
      } catch (e) {
        toast((e as Error).message, true);
        return false;
      }
    },
    [toast],
  );

  const ready = drafts && notes && today;
  const streak = ready ? computeStreak(drafts, today) : 0;
  const shared = ready ? { drafts, today, toast, update } : null;

  return (
    <div className="shell">
      <header className="top">
        <h1>Post Calendar</h1>
        <div className="top-right">
          <span className="streak" title="Consecutive days with a post marked posted">
            Streak <strong>{streak}</strong>
          </span>
          <Link href="/settings" className="small-link">
            Settings
          </Link>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="btn tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "bank" && drafts ? ` (${drafts.filter((d) => d.status === "bank").length})` : ""}
          </button>
        ))}
      </nav>

      <main>
        {!shared || !notes ? (
          <p className="muted center">Loading…</p>
        ) : tab === "calendar" ? (
          <CalendarTab {...shared} />
        ) : tab === "notes" ? (
          <NotesTab notes={notes} toast={toast} refresh={refresh} />
        ) : (
          <BankTab {...shared} />
        )}
      </main>

      {message && (
        <div className={`toast${message.error ? " toast-error" : ""}`} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
}
