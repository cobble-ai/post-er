import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { fail } from "@/lib/api";

export async function GET() {
  const { data, error } = await db()
    .from("drafts")
    .select("id, created_at, note_id, platform, angle, body, status, scheduled_date, posted_at")
    .neq("status", "discarded")
    .order("created_at", { ascending: false });
  if (error) return fail(error);
  return NextResponse.json({ drafts: data });
}
