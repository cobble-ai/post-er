import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { listDrafts, OpError } from "@/lib/ops";

export async function GET() {
  try {
    return NextResponse.json({ drafts: await listDrafts() });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
