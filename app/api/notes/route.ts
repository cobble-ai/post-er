import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { listNotes, OpError } from "@/lib/ops";

export async function GET() {
  try {
    return NextResponse.json({ notes: await listNotes() });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
