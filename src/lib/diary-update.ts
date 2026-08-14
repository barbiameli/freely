/**
 * What goes in the client's update, and what stays in the tracker.
 *
 * "Send to Diary" used to write one line: "2 of 4 deliverables complete so far.
 * Status: ACTIVE." Nothing you had actually ticked appeared in it, so the
 * feature looked broken while doing exactly what it was written to do. It also
 * sent the internal status enum to a paying client.
 *
 * The fix is not a better sentence, it is asking. Everything shareable is listed
 * and everything is included by default except the questions, which are notes to
 * yourself. Deciding what a client sees is not a decision to make on somebody's
 * behalf, and it is the one moment where getting it wrong is public.
 *
 * Pure and separate from the dialog so the composition can be tested: what ends
 * up on a client's page is worth a test.
 */

export type ShareKind = "PROGRESS" | "DONE" | "TODO" | "DUE" | "QUESTION";

export interface ShareItem {
  /** Stable within one dialog, for the checkbox. */
  id: string;
  kind: ShareKind;
  /** The line as the client would read it. */
  text: string;
  /** Included unless somebody turns it off. */
  on: boolean;
}

export interface UpdateSource {
  deliverables: { id: string; name: string; done: boolean }[];
  /** Unresolved flags. Off by default: these are questions in tracker wording. */
  questions: { id: string; question: string }[];
  /** As already formatted for display, since formatting a date needs a locale. */
  dueLabel: string | null;
}

export interface UpdateWords {
  /** "{done} of {total} done". */
  progress: string;
  finished: string;
  stillToCome: string;
  questionsForYou: string;
  /** "Due {date}." */
  due: string;
  title: string;
}

/**
 * Everything this project could tell the client, in the order it would be read.
 *
 * Progress first because it is the answer to "how is it going". Questions last
 * and off, because a question that has not been edited reads as an internal note
 * and half of them are notes to self.
 */
export function shareableItems(source: UpdateSource): ShareItem[] {
  const items: ShareItem[] = [];
  const done = source.deliverables.filter((d) => d.done);
  const todo = source.deliverables.filter((d) => !d.done);

  if (source.deliverables.length > 0) {
    items.push({ id: "progress", kind: "PROGRESS", text: "", on: true });
  }
  for (const d of done) {
    items.push({ id: `done:${d.id}`, kind: "DONE", text: d.name, on: true });
  }
  for (const d of todo) {
    items.push({ id: `todo:${d.id}`, kind: "TODO", text: d.name, on: true });
  }
  if (source.dueLabel) {
    items.push({ id: "due", kind: "DUE", text: source.dueLabel, on: true });
  }
  for (const q of source.questions) {
    items.push({ id: `q:${q.id}`, kind: "QUESTION", text: q.question, on: false });
  }
  return items;
}

export interface ComposedUpdate {
  title: string;
  body: string;
}

/**
 * The update, from whatever was left switched on.
 *
 * Paragraphs with a lead-in rather than a bulleted list, because the diary
 * renders prose and a client reads it as a note rather than a task export.
 *
 * The progress count is recomputed from the deliverables rather than taken from
 * the items, so excluding one deliverable from the list does not leave a total
 * that disagrees with the names underneath it.
 */
export function composeUpdate(
  items: ShareItem[],
  source: UpdateSource,
  words: UpdateWords
): ComposedUpdate {
  const on = items.filter((i) => i.on);
  const named = (kind: ShareKind) => on.filter((i) => i.kind === kind).map((i) => i.text);

  const finished = named("DONE");
  const todo = named("TODO");
  const questions = named("QUESTION");
  const parts: string[] = [];

  if (on.some((i) => i.kind === "PROGRESS")) {
    // Counted over what is being shared, so the number and the list agree.
    const shownDone = finished.length;
    const shownTotal = finished.length + todo.length;
    if (shownTotal > 0) {
      parts.push(
        words.progress
          .replace("{done}", String(shownDone))
          .replace("{total}", String(shownTotal))
      );
    }
  }

  if (finished.length > 0) parts.push(`${words.finished}: ${sentenceList(finished)}.`);
  if (todo.length > 0) parts.push(`${words.stillToCome}: ${sentenceList(todo)}.`);

  const due = on.find((i) => i.kind === "DUE");
  if (due) parts.push(words.due.replace("{date}", due.text));

  if (questions.length > 0) {
    parts.push(`${words.questionsForYou}: ${sentenceList(questions)}`);
  }

  return { title: words.title, body: parts.join("\n\n") };
}

/** Names run together as a phrase, not a list of bullets. */
function sentenceList(names: string[]): string {
  return names.join(", ");
}

/**
 * Whether there is anything worth sending.
 *
 * The progress line on its own does not count. "0 of 0 done" with everything
 * else switched off is an empty update, and sending one tells a client you have
 * been in the tool rather than that anything happened.
 */
export function hasAnythingToSend(items: ShareItem[]): boolean {
  return items.some((i) => i.on && i.kind !== "PROGRESS");
}
