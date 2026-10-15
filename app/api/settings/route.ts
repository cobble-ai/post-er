import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { normalizeAccount } from "@/lib/account";
import { getSettings, OpError, saveSettings } from "@/lib/ops";
import type { Settings } from "@/lib/types";

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
    const patch: Partial<Settings> = {};
    if ("voice_samples" in input) patch.voice_samples = String(input.voice_samples ?? "");
    if ("extra_rules" in input) patch.extra_rules = String(input.extra_rules ?? "");
    if ("onboarded" in input) patch.onboarded = input.onboarded === true;
    if (input.account && typeof input.account === "object") patch.account = normalizeAccount(input.account);
    const settings = await saveSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
