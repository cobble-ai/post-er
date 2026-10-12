import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { fail } from "@/lib/api";

export async function GET() {
  const { data, error } = await db()
    .from("notes")
    .select("id, created_at, raw_text, follow_up_question, follow_up_answer, status")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return fail(error);
  return NextResponse.json({ notes: data });
}
