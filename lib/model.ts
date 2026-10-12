import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5-5";

// No temperature / top_p / top_k on purpose: model defaults apply.
let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const CHECK_SYSTEM = `You review a founder's raw note before it becomes a social post. A good note contains at least one specific thing: a number, a real quote, a concrete failure, or a decision and why. If the note has one, return {"ok": true}. If it is vague (e.g. "worked on the editor today"), return {"ok": false, "question": "<one short question that pulls out the specific thing>"}. Return JSON only.`;

const DRAFT_SYSTEM = `You write social posts for Peter, a young founder in New Zealand building Cobble, an AI video editor for short-form creators, in public with his cofounder Sid.

From the note, find 3 genuinely different angles, not rewordings of one angle. For each angle write one X post and one LinkedIn post.

Rules:
- Who cares: every post must give a stranger with no context a reason to care in the first line. If the note is only interesting to Peter, find the part that is interesting to someone else.
- Build every post on the one specific thing in the note: the number, the quote, the failure, the decision.
- Don't overexplain. Cut every sentence that isn't pulling weight.
- Never sound like a pitch. Do not sell Cobble. Mention it only if the post needs it.
- No hashtags. No emojis unless the voice samples use them. No "Here's what I learned", "Let that sink in", "unpopular opinion", or any LinkedIn-guru phrasing.
- X: one idea, under 280 characters, plain and direct.
- LinkedIn: 60–180 words, short lines, a small story with a point. Not a reformatted X post.
- Match the voice samples if provided.

Return JSON only:
{"angles":[{"angle":"<5-word label>","x":"<post>","linkedin":"<post>"}, ...3 items]}`;

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // The model sometimes adds a sentence around the object.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/** One call that must return JSON. On a parse/shape failure, retry once, then throw. */
async function callJson<T>(system: string, user: string, validate: (v: unknown) => T): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      // This model thinks by default, and those tokens come out of max_tokens.
      // Between-tools leaves the 2000 for the JSON instead of cutting it off.
      thinking: { type: "between_tools" },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return validate(parseJson(text));
    } catch {
      // fall through to retry
    }
  }
  throw new Error("The model returned an unreadable response. Try again.");
}

const isString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export type CheckResult = { ok: true } | { ok: false; question: string };

export function checkNote(note: string): Promise<CheckResult> {
  return callJson(CHECK_SYSTEM, note, (v) => {
    const o = v as { ok?: unknown; question?: unknown };
    if (o.ok === true) return { ok: true as const };
    if (o.ok === false && isString(o.question)) return { ok: false as const, question: o.question.trim() };
    throw new Error("bad shape");
  });
}

export type Angle = { angle: string; x: string; linkedin: string };

export function draftNote(
  note: { text: string; question?: string | null; answer?: string | null },
  settings: { voice_samples: string; extra_rules: string },
): Promise<Angle[]> {
  let system = DRAFT_SYSTEM;
  if (settings.voice_samples.trim()) system += `\n\nVoice samples:\n${settings.voice_samples.trim()}`;
  if (settings.extra_rules.trim()) system += `\n\nExtra rules:\n${settings.extra_rules.trim()}`;

  let user = `Note:\n${note.text}`;
  if (note.question && note.answer) {
    user += `\n\nFollow-up question: ${note.question}\nAnswer: ${note.answer}`;
  }

  return callJson(system, user, (v) => {
    const angles = (v as { angles?: unknown }).angles;
    if (!Array.isArray(angles) || angles.length < 3) throw new Error("bad shape");
    return angles.slice(0, 3).map((a) => {
      const o = a as Record<string, unknown>;
      if (!isString(o.angle) || !isString(o.x) || !isString(o.linkedin)) throw new Error("bad shape");
      return { angle: o.angle.trim(), x: o.x.trim(), linkedin: o.linkedin.trim() };
    });
  });
}
