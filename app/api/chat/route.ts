import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { runChat, type ChatTurn } from "@/lib/chat";
import { OpError } from "@/lib/ops";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const today = String(body.today ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return fail("Missing today's date.", 400);

    const turns: ChatTurn[] = [];
    const raw = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
    for (const item of raw) {
      const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "";
      const text = typeof item?.text === "string" ? item.text.trim().slice(0, 4000) : "";
      if (!role || !text) continue;
      const prev = turns[turns.length - 1];
      if (prev && prev.role === role) prev.text = `${prev.text}\n\n${text}`;
      else turns.push({ role, text });
    }
    if (turns[0]?.role === "assistant") turns.shift();
    if (turns.at(-1)?.role !== "user") return fail("Send a message.", 400);

    return NextResponse.json(await runChat(turns, today));
  } catch (e) {
    return fail(e, e instanceof OpError ? e.status : 500);
  }
}
