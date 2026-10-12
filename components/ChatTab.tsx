"use client";

import { useEffect, useRef, useState } from "react";
import { api, copyText } from "@/lib/client";

type Msg = { role: "user" | "assistant"; text: string; actions?: string[] };

const STORAGE_KEY = "pc-chat";

export default function ChatTab({ today, onChanged, toast }: { today: string; onChanged: () => Promise<void>; toast: (message: string, isError?: boolean) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setMessages(saved.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string"));
    } catch {
      // ignore a bad save
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, ready]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    const history = [...messages, { role: "user" as const, text: message }];
    setMessages(history);
    setText("");
    setBusy(true);
    try {
      const res = await api<{ reply: string; actions: string[]; changed: boolean }>("/api/chat", {
        method: "POST",
        body: { today, messages: history.map(({ role, text: value }) => ({ role, text: value })) },
      });
      setMessages([...history, { role: "assistant", text: res.reply, actions: res.actions }]);
      if (res.changed) await onChanged();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow chat">
      <div className="chat-log" ref={log}>
        {messages.length === 0 && !busy && (
          <p className="muted">Ask to draft a note, fill the week, or mark something posted. The other tabs still work on their own.</p>
        )}
        {messages.map((m, i) => (
          <article key={i} className={`card chat-bubble${m.role === "user" ? " chat-user" : ""}`}>
            {m.actions && m.actions.length > 0 && <p className="chat-actions">{m.actions.join(" · ")}</p>}
            <p className="chat-text">{m.text}</p>
            {m.role === "assistant" && (
              <div className="row-end">
                <button className="btn" onClick={async () => toast((await copyText(m.text)) ? "Copied" : "Couldn't copy")}>
                  Copy
                </button>
              </div>
            )}
          </article>
        ))}
        {busy && <p className="muted">Working…</p>}
      </div>

      <div className="chat-compose stack-sm">
        <textarea
          className="field chat-input"
          aria-label="Message"
          placeholder="Schedule tomorrow's X post, or turn this note into drafts…"
          value={text}
          disabled={busy}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="row-end">
          {messages.length > 0 && (
            <button
              className="small-link"
              onClick={() => {
                setMessages([]);
                localStorage.removeItem(STORAGE_KEY);
              }}
              disabled={busy}
            >
              Clear chat
            </button>
          )}
          <button className="btn btn-primary" onClick={() => void send()} disabled={busy || !text.trim()}>
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
