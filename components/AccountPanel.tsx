"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/lib/types";
import Onboarding from "./Onboarding";

export default function AccountPanel({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Onboarding
        initial={initial}
        onDone={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <section className="card stack-sm">
      <strong>Account</strong>
      <p>{initial.account.sentence || "Not set yet."}</p>
      {initial.account.topics.length > 0 && <p className="muted small">{initial.account.topics.join(" · ")}</p>}
      <div className="row-end">
        <button className="btn" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    </section>
  );
}
