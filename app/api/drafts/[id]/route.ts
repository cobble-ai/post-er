import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { fail } from "@/lib/api";

// PATCH one of:
//   { body }
//   { action: "schedule", date }   bank -> scheduled
//   { action: "unschedule" }       scheduled/posted -> bank
//   { action: "post" }             scheduled -> posted
//   { action: "unpost" }           posted -> scheduled
//   { action: "discard" }          -> discarded
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await req.json();
    const supabase = db();

    let patch: Record<string, unknown>;

    if (typeof input.body === "string") {
      if (!input.body.trim()) return fail("A draft can't be empty.", 400);
      patch = { body: input.body };
    } else if (input.action === "schedule") {
      const date = String(input.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a valid date.", 400);

      const { data: draft, error } = await supabase.from("drafts").select("platform").eq("id", id).single();
      if (error || !draft) return fail("Draft not found.", 404);
      const { data: taken } = await supabase
        .from("drafts")
        .select("id")
        .eq("platform", draft.platform)
        .eq("scheduled_date", date)
        .in("status", ["scheduled", "posted"])
        .neq("id", id)
        .limit(1);
      if (taken && taken.length) return fail("That day already has a post for this platform.", 409);

      patch = { status: "scheduled", scheduled_date: date, posted_at: null };
    } else if (input.action === "unschedule") {
      patch = { status: "bank", scheduled_date: null, posted_at: null };
    } else if (input.action === "post") {
      patch = { status: "posted", posted_at: new Date().toISOString() };
    } else if (input.action === "unpost") {
      patch = { status: "scheduled", posted_at: null };
    } else if (input.action === "discard") {
      patch = { status: "discarded", scheduled_date: null, posted_at: null };
    } else {
      return fail("Unknown update.", 400);
    }

    const { data, error } = await supabase
      .from("drafts")
      .update(patch)
      .eq("id", id)
      .select("id, created_at, note_id, platform, angle, body, status, scheduled_date, posted_at")
      .single();
    if (error) return fail(error);
    return NextResponse.json({ draft: data });
  } catch (e) {
    return fail(e);
  }
}
