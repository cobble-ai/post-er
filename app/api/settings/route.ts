import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { fail } from "@/lib/api";

export async function GET() {
  const { data, error } = await db().from("settings").select("voice_samples, extra_rules").eq("id", 1).maybeSingle();
  if (error) return fail(error);
  return NextResponse.json({ settings: data ?? { voice_samples: "", extra_rules: "" } });
}

export async function PUT(req: Request) {
  try {
    const input = await req.json();
    const { error } = await db()
      .from("settings")
      .upsert({
        id: 1,
        voice_samples: String(input.voice_samples ?? ""),
        extra_rules: String(input.extra_rules ?? ""),
      });
    if (error) return fail(error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
