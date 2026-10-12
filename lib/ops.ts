import "server-only";
import { db } from "@/lib/supabase";
import { checkNote, draftNote } from "@/lib/model";
import type { Draft, Note, Platform, Settings } from "@/lib/types";

export class OpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const DRAFT_COLUMNS = "id, created_at, note_id, platform, angle, body, status, scheduled_date, posted_at";

function throwIf(error: { message: string } | null, fallback: string): void {
  if (error) throw new OpError(error.message || fallback, 500);
}

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await db()
    .from("notes")
    .select("id, created_at, raw_text, follow_up_question, follow_up_answer, status")
    .order("created_at", { ascending: false })
    .limit(30);
  throwIf(error, "Could not load notes.");
  return (data ?? []) as Note[];
}

export async function listDrafts(opts?: { discarded?: boolean }): Promise<Draft[]> {
  const query = db().from("drafts").select(DRAFT_COLUMNS).order("created_at", { ascending: false });
  const { data, error } = await (opts?.discarded ? query.eq("status", "discarded") : query.neq("status", "discarded"));
  throwIf(error, "Could not load drafts.");
  return (data ?? []) as Draft[];
}

export async function getDraft(id: string): Promise<Draft> {
  const { data, error } = await db().from("drafts").select(DRAFT_COLUMNS).eq("id", id).single();
  if (error || !data) throw new OpError("Draft not found.", 404);
  return data as Draft;
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("voice_samples, extra_rules").eq("id", 1).maybeSingle();
  throwIf(error, "Could not load settings.");
  return {
    voice_samples: (data?.voice_samples as string) ?? "",
    extra_rules: (data?.extra_rules as string) ?? "",
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = {
    voice_samples: patch.voice_samples ?? current.voice_samples,
    extra_rules: patch.extra_rules ?? current.extra_rules,
  };
  const { error } = await db().from("settings").upsert({ id: 1, ...next });
  throwIf(error, "Could not save settings.");
  return next;
}

export type Drafted = { status: "drafted"; count: number; drafts: Draft[] };
export type NeedsDetail = { status: "needs_detail"; noteId: string; question: string };

async function writeDrafts(
  noteId: string,
  text: string,
  question: string | null,
  answer: string | null,
  isNew: boolean,
): Promise<Drafted> {
  const voice = await getSettings();
  let angles;
  try {
    angles = await draftNote({ text, question, answer }, voice);
  } catch (e) {
    if (isNew) await db().from("notes").delete().eq("id", noteId);
    throw e;
  }

  const base = Date.now();
  const rows = angles.flatMap((a, i) =>
    (["x", "linkedin"] as const).map((platform, j) => ({
      note_id: noteId,
      platform,
      angle: a.angle,
      body: platform === "x" ? a.x : a.linkedin,
      status: "bank",
      created_at: new Date(base - (i * 2 + j)).toISOString(),
    })),
  );
  const { data, error } = await db().from("drafts").insert(rows).select(DRAFT_COLUMNS);
  throwIf(error, "Could not save drafts.");

  const { error: noteError } = await db()
    .from("notes")
    .update({ status: "drafted", ...(answer ? { follow_up_answer: answer } : {}) })
    .eq("id", noteId);
  throwIf(noteError, "Could not update the note.");

  return { status: "drafted", count: rows.length, drafts: (data ?? []) as Draft[] };
}

export async function addNote(raw: string): Promise<Drafted | NeedsDetail> {
  const text = raw.trim();
  if (!text) throw new OpError("Write a note first.");

  const check = await checkNote(text);
  const { data: note, error } = await db()
    .from("notes")
    .insert({
      raw_text: text,
      status: "needs_detail",
      follow_up_question: check.ok ? null : check.question,
    })
    .select("id")
    .single();
  if (error || !note) throw new OpError(error?.message || "Could not save note.", 500);
  if (!check.ok) return { status: "needs_detail", noteId: note.id as string, question: check.question };
  return writeDrafts(note.id as string, text, null, null, true);
}

export async function answerFollowUp(noteId: string, rawAnswer: string): Promise<Drafted> {
  const answer = rawAnswer.trim();
  if (!answer) throw new OpError("Write an answer first.");
  const { data: note, error } = await db().from("notes").select("*").eq("id", noteId).single();
  if (error || !note) throw new OpError("Note not found.", 404);
  if (note.status !== "needs_detail") throw new OpError("That note is already drafted.", 409);
  return writeDrafts(note.id as string, note.raw_text as string, (note.follow_up_question as string | null) ?? null, answer, false);
}

export type DraftChange =
  | { body: string }
  | { action: "schedule"; date: string }
  | { action: "unschedule" | "post" | "unpost" | "discard" };

export async function updateDraft(id: string, input: DraftChange): Promise<Draft> {
  const supabase = db();
  let patch: Record<string, unknown>;

  if ("body" in input) {
    if (!input.body.trim()) throw new OpError("A draft can't be empty.");
    patch = { body: input.body };
  } else if (input.action === "schedule") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new OpError("Pick a valid date.");
    const draft = await getDraft(id);
    const { data: taken } = await supabase
      .from("drafts")
      .select("id")
      .eq("platform", draft.platform)
      .eq("scheduled_date", input.date)
      .in("status", ["scheduled", "posted"])
      .neq("id", id)
      .limit(1);
    if (taken && taken.length) throw new OpError("That day already has a post for this platform.", 409);
    patch = { status: "scheduled", scheduled_date: input.date, posted_at: null };
  } else if (input.action === "unschedule") {
    patch = { status: "bank", scheduled_date: null, posted_at: null };
  } else if (input.action === "post") {
    patch = { status: "posted", posted_at: new Date().toISOString() };
  } else if (input.action === "unpost") {
    patch = { status: "scheduled", posted_at: null };
  } else {
    patch = { status: "discarded", scheduled_date: null, posted_at: null };
  }

  const { data, error } = await supabase.from("drafts").update(patch).eq("id", id).select(DRAFT_COLUMNS).single();
  if (error || !data) throw new OpError(error?.message || "Draft not found.", error ? 500 : 404);
  return data as Draft;
}

export function isPlatform(v: string): v is Platform {
  return v === "x" || v === "linkedin";
}
