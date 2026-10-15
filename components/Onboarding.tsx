"use client";

import { useState } from "react";
import { AUDIENCES, NEVERS, TONES, TOPICS, type AccountProfile, type OffTopic } from "@/lib/account";
import { api } from "@/lib/client";
import type { Settings } from "@/lib/types";

const STEPS = 5;

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export default function Onboarding({ initial, onDone }: { initial: Settings; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState<AccountProfile>(initial.account);
  const [voice, setVoice] = useState(initial.voice_samples);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(next: Partial<AccountProfile>) {
    setAccount({ ...account, ...next });
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await api("/api/settings", {
        method: "PUT",
        body: { voice_samples: voice, account, onboarded: true },
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function next() {
    if (step === 0 && account.sentence.trim().length < 8) {
      setError("Say what the account is about, in a sentence.");
      return;
    }
    if (step === 0 && account.topics.length === 0) {
      setError("Pick at least one topic.");
      return;
    }
    if (step === 2 && account.audience.length === 0) {
      setError("Pick who it's for.");
      return;
    }
    setError("");
    if (step === STEPS - 1) void finish();
    else setStep(step + 1);
  }

  return (
    <div className="stack">
      <header className="top">
        <h1>Your account</h1>
        <span className="muted">
          {step + 1} of {STEPS}
        </span>
      </header>

      {step === 0 && (
        <section className="stack">
          <p>What is this account about? Drafts have to stay inside this, even when a note doesn't.</p>
          <textarea
            className="field"
            rows={3}
            aria-label="What the account is about"
            placeholder="Building a startup in public. Tech, product, and the work with my cofounder."
            value={account.sentence}
            onChange={(e) => patch({ sentence: e.target.value })}
          />
          <div className="choices" role="group" aria-label="Topics">
            {TOPICS.map((topic) => (
              <button key={topic} type="button" className="btn choice" aria-pressed={account.topics.includes(topic)} onClick={() => patch({ topics: toggle(account.topics, topic) })}>
                {topic}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="stack">
          <label className="stack-sm">
            <strong>About you</strong>
            <span className="muted small">Name, what you're building, where, who you build it with.</span>
            <textarea className="field" rows={4} value={account.about} onChange={(e) => patch({ about: e.target.value })} placeholder="I'm Peter. I build Cobble, an AI video editor, in New Zealand with Sid." />
          </label>
          <label className="stack-sm">
            <strong>Paste the account</strong>
            <span className="muted small">Bio, about section, or a pinned post from X or LinkedIn.</span>
            <textarea className="field settings-box" value={account.bio} onChange={(e) => patch({ bio: e.target.value })} placeholder="Paste it here." />
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <p>Who is a post for?</p>
          <div className="choices" role="group" aria-label="Audience">
            {AUDIENCES.map((item) => (
              <button key={item} type="button" className="btn choice" aria-pressed={account.audience.includes(item)} onClick={() => patch({ audience: toggle(account.audience, item) })}>
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="stack">
          <p>A note about golf, on an account about startups. What should the bank do?</p>
          <div className="stack-sm" role="radiogroup" aria-label="Off-topic notes">
            <button type="button" className="btn choice choice-block" aria-pressed={account.offTopic === "tie-back"} onClick={() => patch({ offTopic: "tie-back" satisfies OffTopic })}>
              Keep the post about the account. Golf can be one clause, never the subject.
            </button>
            <button type="button" className="btn choice choice-block" aria-pressed={account.offTopic === "ask"} onClick={() => patch({ offTopic: "ask" satisfies OffTopic })}>
              Don't draft it yet. Ask me for the part that belongs on the account.
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="stack">
          <p>How should it sound?</p>
          <div className="choices" role="group" aria-label="Tone">
            {TONES.map((item) => (
              <button key={item} type="button" className="btn choice" aria-pressed={account.tone.includes(item)} onClick={() => patch({ tone: toggle(account.tone, item) })}>
                {item}
              </button>
            ))}
          </div>
          <p>Never</p>
          <div className="choices" role="group" aria-label="Never">
            {NEVERS.map((item) => (
              <button key={item} type="button" className="btn choice" aria-pressed={account.never.includes(item)} onClick={() => patch({ never: toggle(account.never, item) })}>
                {item}
              </button>
            ))}
          </div>
          <label className="stack-sm">
            <strong>Past posts</strong>
            <span className="muted small">Optional. Drafts match this voice.</span>
            <textarea className="field settings-box" value={voice} onChange={(e) => setVoice(e.target.value)} />
          </label>
        </section>
      )}

      {error && <p className="warn">{error}</p>}

      <div className="row-end">
        {step > 0 && (
          <button type="button" className="btn" onClick={() => { setError(""); setStep(step - 1); }} disabled={busy}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
          {busy ? "Saving…" : step === STEPS - 1 ? "Save" : "Next"}
        </button>
      </div>
    </div>
  );
}
