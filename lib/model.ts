import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { accountBrief, type AccountProfile } from "@/lib/account";
import type { Settings } from "@/lib/types";

export const MODEL = "claude-sonnet-5-5";

// No temperature / top_p / top_k on purpose: model defaults apply.
let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const CHECK_SYSTEM = `You review a raw note before it becomes a social post for a specific account. A good note contains at least one specific thing that serves that account: a number, a real quote, a concrete failure, or a decision and why. If the note has one, return {"ok": true}. If it is vague, or it is only about something the account is not about, return {"ok": false, "question": "<one short question>"}. The question must pull out a detail for THIS account. Do not ask for more about an off-topic activity. A golf score is not the detail. The decision, the cost to the work, or the quote that belongs on the account is. Return JSON only.`;

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
- The note is raw material. The subject of every post is the account, not whatever activity the note happens to mention. Three angles are three different points for this audience, not three ways to retell an off-topic activity.
- The first line is about that subject. Do not open with an off-topic activity, and do not report its score, result, or play-by-play.
- If the note is off-topic, none of the six posts may be about that activity. Mention it in one clause at most, after the point, or leave it out. A startup account does not get a golf post. "Shot 92 yesterday" is a failed post. "The bug we'd circled for four days took twenty minutes this morning, after a day away" is the shape, and the day away does not need to be named.
- Angle labels name the account's point, not the activity.
- For each post, recommend exactly 3 media options to publish alongside it. Mix images and videos. Each option is one sentence describing what to shoot or show. Recommend only. No URLs, no files, no claims that the media exists.

Return JSON only:
{"angles":[{"angle":"<5-word label>","x":"<post>","x_media":["<option>","<option>","<option>"],"linkedin":"<post>","linkedin_media":["<option>","<option>","<option>"]}, ...3 items]}`;

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

function withAccount(system: string, account: AccountProfile): string {
  const brief = accountBrief(account);
  return brief ? `${system}\n\nAccount:\n${brief}` : system;
}

export function checkNote(note: string, account: AccountProfile): Promise<CheckResult> {
  return callJson(withAccount(CHECK_SYSTEM, account), note, (v) => {
    const o = v as { ok?: unknown; question?: unknown };
    if (o.ok === true) return { ok: true as const };
    if (o.ok === false && isString(o.question)) return { ok: false as const, question: o.question.trim() };
    throw new Error("bad shape");
  });
}

export type Angle = { angle: string; x: string; linkedin: string; xMedia: string[]; linkedinMedia: string[] };

function mediaList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isString).map((item) => item.trim()).slice(0, 3);
}

export function draftNote(
  note: { text: string; question?: string | null; answer?: string | null },
  settings: Settings,
): Promise<Angle[]> {
  let system = withAccount(DRAFT_SYSTEM, settings.account);
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
      return {
        angle: o.angle.trim(),
        x: o.x.trim(),
        linkedin: o.linkedin.trim(),
        xMedia: mediaList(o.x_media),
        linkedinMedia: mediaList(o.linkedin_media),
      };
    });
  });
}
