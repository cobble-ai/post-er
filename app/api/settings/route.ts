import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getSettings, OpError, saveSettings } from "@/lib/ops";

export async function GET() {
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}

export async function PUT(req: Request) {
  try {
    const input = await req.json();
    const settings = await saveSettings({
      voice_samples: String(input.voice_samples ?? ""),
      extra_rules: String(input.extra_rules ?? ""),
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
