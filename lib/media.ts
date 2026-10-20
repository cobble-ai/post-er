// Media ideas are stored on the angle column so drafts need no extra database column.
const MARK = "\n@@media@@\n";

export function packAngle(angle: string, media: string[]): string {
  const ideas = media.map((item) => item.trim()).filter(Boolean).slice(0, 3);
  if (!ideas.length) return angle.trim();
  return `${angle.trim()}${MARK}${JSON.stringify(ideas)}`;
}

export function unpackAngle(stored: string): { angle: string; media: string[] } {
  const at = stored.indexOf(MARK);
  if (at === -1) return { angle: stored, media: [] };
  try {
    const parsed = JSON.parse(stored.slice(at + MARK.length)) as unknown;
    const media = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : [];
    return { angle: stored.slice(0, at).trim(), media };
  } catch {
    return { angle: stored, media: [] };
  }
}
