import "server-only";
import { NextResponse } from "next/server";

// Accepts an Error, a Supabase error object ({ message }), or a plain string.
export function fail(e: unknown, status = 500) {
  const message =
    typeof e === "string"
      ? e
      : e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Something went wrong";
  return NextResponse.json({ error: message }, { status });
}
