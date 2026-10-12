import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { addDays, parseISODate, startOfWeek } from "@/lib/dates";
import { MODEL, anthropic } from "@/lib/model";
import {
  addNote,
  answerFollowUp,
  getDraft,
  getSettings,
  isPlatform,
  listDrafts,
  listNotes,
  OpError,
  saveSettings,
  updateDraft,
} from "@/lib/ops";
import { computeStreak, nextEmptyDay, slotFor } from "@/lib/schedule";
import type { Draft, DraftStatus, Platform } from "@/lib/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ChatTurn = { role: "user" | "assistant"; text: string };

type ToolOutcome = { data: unknown; action?: string; changed?: boolean; isError?: boolean };

const TOOLS: Anthropic.Tool[] = [
  {
    name: "overview",
    description: "Streak, how many drafts are in the bank, notes waiting on a follow-up, and this week's calendar slots. Start here for 'what should I post' or 'what's my streak'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_notes",
    description: "Recent notes, newest first, including any unanswered follow-up question.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_note",
    description: "Save a raw note and run the normal drafting pipeline. If the note is too vague this returns one follow-up question and does not draft. Ask Peter that question, then call answer_follow_up. If it is specific, this creates 6 bank drafts (3 angles, X and LinkedIn each).",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "The raw note, in Peter's words." } },
      required: ["text"],
    },
  },
  {
    name: "answer_follow_up",
    description: "Answer the follow-up on a note that is waiting for detail, then draft it. Only call this after Peter has answered.",
    input_schema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        answer: { type: "string" },
      },
      required: ["note_id", "answer"],
    },
  },
  {
    name: "list_drafts",
    description: "Drafts Peter can work with. Discarded drafts are hidden unless status is 'discarded'. Bodies are included so you can quote or edit them.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["bank", "scheduled", "posted", "discarded"] },
        platform: { type: "string", enum: ["x", "linkedin"] },
      },
    },
  },
  {
    name: "update_draft",
    description: "Change one draft the same way the buttons do. action 'schedule' needs a YYYY-MM-DD date, or 'next' for the next day with an empty slot on that platform. 'post' marks it posted, 'unpost' undoes that, 'unschedule' sends it back to the bank, 'discard' removes it. Pass body to rewrite the text. body and action may be used together.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        body: { type: "string" },
        action: { type: "string", enum: ["schedule", "unschedule", "post", "unpost", "discard"] },
        date: { type: "string", description: "YYYY-MM-DD or 'next'. Only used with schedule." },
      },
      required: ["id"],
    },
  },
  {
    name: "calendar",
    description: "One week, Monday to Sunday. Each day has an X slot and a LinkedIn slot. A slot is empty, scheduled, or posted.",
    input_schema: {
      type: "object",
      properties: { start: { type: "string", description: "Any day in the week, YYYY-MM-DD. Defaults to the week containing today." } },
    },
  },
  {
    name: "get_settings",
    description: "Voice samples and extra rules used when drafting.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_settings",
    description: "Replace voice samples, extra rules, or both. Omitted fields stay as they are. Affects future drafts only.",
    input_schema: {
      type: "object",
      properties: {
        voice_samples: { type: "string" },
        extra_rules: { type: "string" },
      },
    },
  },
];

function systemPrompt(today: string): string {
  const weekday = WEEKDAYS[parseISODate(today).getDay()];
  return `You are the assistant inside Post Calendar, Peter's private app for posting daily on X and LinkedIn. He can already do everything by hand. You do those same things with tools, and you do not do anything the app itself cannot do.

Today is ${weekday} ${today}. Tomorrow is ${addDays(today, 1)}. Dates are YYYY-MM-DD in Peter's local calendar. Weeks run Monday to Sunday. Each day has one X slot and one LinkedIn slot.

Rules:
- Never claim you changed something unless a tool result says it worked.
- A vague note gets one follow-up question from add_note. Ask Peter that question and wait. Do not invent the missing detail and do not call answer_follow_up until he answers.
- Do not mark a post as posted unless he says he posted it.
- Copying to the clipboard is manual. When he wants the text, quote the draft so he can copy it.
- Scheduling onto a filled slot fails. Use date "next" to take the next empty day for that platform.
- The streak counts consecutive days, ending today or yesterday, with at least one post marked posted.
- Be brief. Say what you changed.`;
}

function clip(draft: Draft) {
  return {
    id: draft.id,
    platform: draft.platform,
    angle: draft.angle,
    status: draft.status,
    scheduled_date: draft.scheduled_date,
    body: draft.body,
  };
}

function slot(drafts: Draft[], day: string, platform: Platform) {
  const draft = slotFor(drafts, day, platform);
  return draft ? { id: draft.id, angle: draft.angle, status: draft.status, body: draft.body } : null;
}

async function runTool(name: string, input: unknown, today: string): Promise<ToolOutcome> {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const str = (key: string) => (typeof o[key] === "string" ? (o[key] as string).trim() : "");
  try {
    if (name === "overview") {
      const [drafts, notes] = await Promise.all([listDrafts(), listNotes()]);
      const week = startOfWeek(today);
      return {
        data: {
          today,
          streak: computeStreak(drafts, today),
          bank: {
            x: drafts.filter((d) => d.status === "bank" && d.platform === "x").length,
            linkedin: drafts.filter((d) => d.status === "bank" && d.platform === "linkedin").length,
          },
          needs_detail: notes.filter((n) => n.status === "needs_detail").map((n) => ({ id: n.id, question: n.follow_up_question, text: n.raw_text })),
          week: Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((day) => ({
            date: day,
            x: slot(drafts, day, "x"),
            linkedin: slot(drafts, day, "linkedin"),
          })),
        },
      };
    }

    if (name === "list_notes") {
      const notes = await listNotes();
      return { data: { notes } };
    }

    if (name === "add_note") {
      const result = await addNote(str("text"));
      if (result.status === "needs_detail") {
        return { data: result, changed: true, action: "Saved a note that needs a detail" };
      }
      return { data: { status: "drafted", count: result.count, drafts: result.drafts.map(clip) }, changed: true, action: `Added ${result.count} drafts to the bank` };
    }

    if (name === "answer_follow_up") {
      const result = await answerFollowUp(str("note_id"), str("answer"));
      return { data: { status: "drafted", count: result.count, drafts: result.drafts.map(clip) }, changed: true, action: `Added ${result.count} drafts to the bank` };
    }

    if (name === "list_drafts") {
      const status = str("status") as DraftStatus | "";
      const platform = str("platform");
      let drafts = await listDrafts({ discarded: status === "discarded" });
      if (status && status !== "discarded") drafts = drafts.filter((d) => d.status === status);
      if (platform) {
        if (!isPlatform(platform)) return { data: { error: "platform must be x or linkedin" }, isError: true };
        drafts = drafts.filter((d) => d.platform === platform);
      }
      const shown = drafts.slice(0, 40).map(clip);
      return { data: { drafts: shown, truncated: drafts.length > shown.length } };
    }

    if (name === "update_draft") {
      const id = str("id");
      if (!id) return { data: { error: "id is required" }, isError: true };
      const body = typeof o.body === "string" ? o.body : "";
      const action = str("action");
      let draft: Draft | null = null;
      if (body) draft = await updateDraft(id, { body });
      if (action === "schedule") {
        let date = str("date");
        if (!date || date === "next") {
          const current = draft ?? (await getDraft(id));
          date = nextEmptyDay(await listDrafts(), current.platform, today);
        }
        draft = await updateDraft(id, { action: "schedule", date });
      } else if (action === "unschedule" || action === "post" || action === "unpost" || action === "discard") {
        draft = await updateDraft(id, { action });
      } else if (action) {
        return { data: { error: "Unknown action." }, isError: true };
      } else if (!body) {
        return { data: { error: "Pass a body, an action, or both." }, isError: true };
      }
      const done = draft!;
      const label =
        action === "schedule"
          ? `Scheduled ${done.platform === "x" ? "X" : "LinkedIn"} for ${done.scheduled_date}`
          : action === "unschedule"
            ? "Moved a draft back to the bank"
            : action === "post"
              ? `Marked ${done.platform === "x" ? "X" : "LinkedIn"} posted`
              : action === "unpost"
                ? "Undid posted"
                : action === "discard"
                  ? "Discarded a draft"
                  : "Edited a draft";
      return { data: { draft: clip(done) }, changed: true, action: label };
    }

    if (name === "calendar") {
      const start = startOfWeek(str("start") || today);
      const drafts = await listDrafts();
      return {
        data: {
          streak: computeStreak(drafts, today),
          days: Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((day) => ({
            date: day,
            weekday: WEEKDAYS[parseISODate(day).getDay()],
            x: slot(drafts, day, "x"),
            linkedin: slot(drafts, day, "linkedin"),
          })),
        },
      };
    }

    if (name === "get_settings") return { data: await getSettings() };

    if (name === "update_settings") {
      const patch: { voice_samples?: string; extra_rules?: string } = {};
      if (typeof o.voice_samples === "string") patch.voice_samples = o.voice_samples;
      if (typeof o.extra_rules === "string") patch.extra_rules = o.extra_rules;
      if (!("voice_samples" in patch) && !("extra_rules" in patch)) {
        return { data: { error: "Pass voice_samples, extra_rules, or both." }, isError: true };
      }
      const settings = await saveSettings(patch);
      return { data: { settings }, changed: true, action: "Updated settings" };
    }

    return { data: { error: `Unknown tool ${name}` }, isError: true };
  } catch (e) {
    const message = e instanceof OpError || e instanceof Error ? e.message : "Something went wrong";
    return { data: { error: message }, isError: true };
  }
}

export async function runChat(turns: ChatTurn[], today: string): Promise<{ reply: string; actions: string[]; changed: boolean }> {
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
  const actions: string[] = [];
  let changed = false;
  let reply = "";

  for (let step = 0; step < 8; step++) {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "between_tools" },
      system: systemPrompt(today),
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) reply = text;

    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || uses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of uses) {
      const outcome = await runTool(use.name, use.input, today);
      if (outcome.changed) changed = true;
      if (outcome.action) actions.push(outcome.action);
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(outcome.data),
        is_error: outcome.isError === true,
      });
    }
    messages.push({ role: "user", content: results });
  }

  if (!reply) reply = actions.length ? "Done." : "I couldn't finish that. Try again.";
  return { reply, actions, changed };
}
