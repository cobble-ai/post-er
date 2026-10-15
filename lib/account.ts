// Stored at the end of settings.extra_rules so onboarding needs no new table.
const MARK = "\n\n@@post-calendar-account@@\n";

export const TOPICS = ["Startups", "Building a product", "Tech", "AI", "Writing", "Design", "Creators"];
export const AUDIENCES = ["Founders", "Engineers", "Creators", "Customers", "Investors", "People in my industry"];
export const TONES = ["Plain and direct", "Short", "Specific", "A small story", "Dry, no hype"];
export const NEVERS = [
  "Posts about an off-topic hobby",
  "Pitching or selling",
  "Hashtags",
  "Emojis",
  "LinkedIn-guru phrasing",
];

export type OffTopic = "tie-back" | "ask";

export type AccountProfile = {
  sentence: string;
  topics: string[];
  audience: string[];
  bio: string;
  about: string;
  offTopic: OffTopic;
  tone: string[];
  never: string[];
};

export function emptyAccount(): AccountProfile {
  return {
    sentence: "",
    topics: [],
    audience: [],
    bio: "",
    about: "",
    offTopic: "tie-back",
    tone: ["Plain and direct", "Specific"],
    never: ["Posts about an off-topic hobby", "Pitching or selling", "Hashtags", "LinkedIn-guru phrasing"],
  };
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

export function normalizeAccount(value: unknown): AccountProfile {
  const blank = emptyAccount();
  if (!value || typeof value !== "object") return blank;
  const o = value as Record<string, unknown>;
  return {
    sentence: typeof o.sentence === "string" ? o.sentence.trim() : "",
    topics: strings(o.topics),
    audience: strings(o.audience),
    bio: typeof o.bio === "string" ? o.bio.trim() : "",
    about: typeof o.about === "string" ? o.about.trim() : "",
    offTopic: o.offTopic === "ask" ? "ask" : "tie-back",
    tone: Array.isArray(o.tone) ? strings(o.tone) : blank.tone,
    never: Array.isArray(o.never) ? strings(o.never) : blank.never,
  };
}

export function splitStoredRules(extra: string): { rules: string; account: AccountProfile; onboarded: boolean } {
  const at = extra.indexOf(MARK);
  if (at === -1) return { rules: extra, account: emptyAccount(), onboarded: false };
  try {
    const saved = JSON.parse(extra.slice(at + MARK.length)) as { onboarded?: unknown; account?: unknown };
    return { rules: extra.slice(0, at).trimEnd(), account: normalizeAccount(saved.account), onboarded: saved.onboarded === true };
  } catch {
    return { rules: extra, account: emptyAccount(), onboarded: false };
  }
}

export function joinStoredRules(rules: string, account: AccountProfile, onboarded: boolean): string {
  const head = rules.trimEnd();
  return `${head}${MARK}${JSON.stringify({ onboarded, account })}`;
}

/** Text appended to every check and draft call. Empty until onboarding is done. */
export function accountBrief(account: AccountProfile): string {
  if (!account.sentence && account.topics.length === 0 && !account.bio && !account.about) return "";
  const off =
    account.offTopic === "ask"
      ? "If a note is not about this account, do not draft from it. Ask for the part that is."
      : "If a note is off-topic, the post is still about this account. The off-topic activity is at most one clause of hook. It is never the subject of the post.";
  return [
    account.sentence && `This account is about: ${account.sentence}`,
    account.topics.length && `Topics: ${account.topics.join(", ")}`,
    account.audience.length && `Written for: ${account.audience.join(", ")}`,
    account.about && `About the person:\n${account.about}`,
    account.bio && `Bio and other account details:\n${account.bio}`,
    account.tone.length && `Tone: ${account.tone.join(", ")}`,
    account.never.length && `Never:\n${account.never.map((item) => `- ${item}`).join("\n")}`,
    off,
  ]
    .filter(Boolean)
    .join("\n");
}
