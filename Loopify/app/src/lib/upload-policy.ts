/** Persist the session before sending bytes; ambiguous completions must not create new videos. */
export function resumeOffset(range: string | null, total: number) {
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range);
  if (!match) throw new Error("Invalid resumable upload range");
  const offset = Number(match[1]) + 1;
  if (!Number.isSafeInteger(offset) || offset < 1 || offset > total) throw new Error("Invalid resumable upload offset");
  return offset;
}

export function publicationStatus(scheduledAt: string, now = Date.now()) {
  const time = Date.parse(scheduledAt);
  if (!Number.isFinite(time)) throw new Error("Invalid scheduled time");
  if (time <= now) return { privacyStatus: "public", selfDeclaredMadeForKids: false };
  return { privacyStatus: "private", publishAt: new Date(time).toISOString(), selfDeclaredMadeForKids: false };
}
