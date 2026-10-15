export type Platform = "x" | "linkedin";
export type DraftStatus = "bank" | "scheduled" | "posted" | "discarded";

export type Note = {
  id: string;
  created_at: string;
  raw_text: string;
  follow_up_question: string | null;
  follow_up_answer: string | null;
  status: "needs_detail" | "drafted";
};

export type Draft = {
  id: string;
  created_at: string;
  note_id: string;
  platform: Platform;
  angle: string;
  body: string;
  status: DraftStatus;
  scheduled_date: string | null; // YYYY-MM-DD
  posted_at: string | null;
};

import type { AccountProfile } from "./account";

export type Settings = {
  voice_samples: string;
  extra_rules: string;
  account: AccountProfile;
  onboarded: boolean;
};
