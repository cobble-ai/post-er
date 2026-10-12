import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { addNote, answerFollowUp, OpError } from "@/lib/ops";

export const maxDuration = 60;

// POST { text }              -> save note, specificity check, then draft (or ask a follow-up)
// POST { noteId, answer }    -> answer a pending follow-up, then draft
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.noteId === "string") {
      const result = await answerFollowUp(body.noteId, String(body.answer ?? ""));
      return NextResponse.json({ status: "drafted", count: result.count });
    }
    const result = await addNote(String(body.text ?? ""));
    if (result.status === "needs_detail") return NextResponse.json(result);
    return NextResponse.json({ status: "drafted", count: result.count });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
