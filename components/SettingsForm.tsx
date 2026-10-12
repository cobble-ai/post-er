"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { Settings } from "@/lib/types";

export default function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      await api("/api/settings", { method: "PUT", body: values });
      setStatus({ text: "Saved", error: false });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label className="stack-sm">
        <strong>Voice samples</strong>
        <span className="muted small">Paste some of your past posts. Drafts will match this voice.</span>
        <textarea
          className="field settings-box"
          value={values.voice_samples}
          onChange={(e) => setValues({ ...values, voice_samples: e.target.value })}
        />
      </label>
      <label className="stack-sm">
        <strong>Extra rules</strong>
        <span className="muted small">Anything else the drafts should always (or never) do.</span>
        <textarea
          className="field settings-box"
          value={values.extra_rules}
          onChange={(e) => setValues({ ...values, extra_rules: e.target.value })}
        />
      </label>
      <div className="row-end">
        {status && <span className={status.error ? "warn" : "muted"}>{status.text}</span>}
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
