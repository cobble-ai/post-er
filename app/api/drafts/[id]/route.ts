import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { OpError, updateDraft, type DraftChange } from "@/lib/ops";

// PATCH one of:
//   { body }
//   { action: "schedule", date }   -> scheduled
//   { action: "unschedule" }       -> bank
//   { action: "post" }             -> posted
//   { action: "unpost" }           -> scheduled
//   { action: "discard" }          -> discarded
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await req.json();

    let change: DraftChange;
    if (typeof input.body === "string") {
      change = { body: input.body };
    } else if (input.action === "schedule") {
      change = { action: "schedule", date: String(input.date ?? "") };
    } else if (input.action === "unschedule" || input.action === "post" || input.action === "unpost" || input.action === "discard") {
      change = { action: input.action };
    } else {
      return fail("Unknown update.", 400);
    }

    return NextResponse.json({ draft: await updateDraft(id, change) });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
