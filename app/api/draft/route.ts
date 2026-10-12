import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { checkNote, draftNote } from "@/lib/model";
import { fail } from "@/lib/api";

export const maxDuration = 60;

// POST { text }              -> save note, specificity check, then draft (or ask a follow-up)
// POST { noteId, answer }    -> answer a pending follow-up, then draft
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = db();

    const { data: settings } = await supabase.from("settings").select("voice_samples, extra_rules").eq("id", 1).maybeSingle();
    const voice = {
      voice_samples: (settings?.voice_samples as string) ?? "",
      extra_rules: (settings?.extra_rules as string) ?? "",
    };

    let noteId: string;
    let isNew = false;
    let text: string;
    let question: string | null = null;
    let answer: string | null = null;

    if (typeof body.noteId === "string") {
      answer = String(body.answer ?? "").trim();
      if (!answer) return fail("Write an answer first.", 400);
      const { data: note, error } = await supabase.from("notes").select("*").eq("id", body.noteId).single();
      if (error || !note) return fail("Note not found.", 404);
      if (note.status !== "needs_detail") return fail("That note is already drafted.", 409);
      noteId = note.id as string;
      text = note.raw_text as string;
      question = note.follow_up_question as string | null;
    } else {
      text = String(body.text ?? "").trim();
      if (!text) return fail("Write a note first.", 400);

      const check = await checkNote(text);
      const { data: note, error } = await supabase
        .from("notes")
        .insert({
          raw_text: text,
          status: "needs_detail",
          follow_up_question: check.ok ? null : check.question,
        })
        .select("id")
        .single();
      if (error || !note) return fail(error ?? "Could not save note.");
      noteId = note.id as string;
      isNew = true;

      if (!check.ok) return NextResponse.json({ status: "needs_detail", noteId, question: check.question });
    }

    let angles;
    try {
      angles = await draftNote({ text, question, answer }, voice);
    } catch (e) {
      // Don't leave a half-processed note behind; the client still has the text.
      if (isNew) await supabase.from("notes").delete().eq("id", noteId);
      throw e;
    }

    // created_at counts down so the Bank (newest first) shows angle 1 first.
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
    const { error: insertError } = await supabase.from("drafts").insert(rows);
    if (insertError) throw insertError;

    const { error: noteError } = await supabase
      .from("notes")
      .update({ status: "drafted", ...(answer ? { follow_up_answer: answer } : {}) })
      .eq("id", noteId);
    if (noteError) throw noteError;

    return NextResponse.json({ status: "drafted", count: rows.length });
  } catch (e) {
    return fail(e);
  }
}
