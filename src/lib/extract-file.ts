/**
 * Reading an uploaded file into text.
 *
 * Every upload in the app did this by hand, and most did it without a
 * try/catch, so a dropped connection or a non-JSON response threw inside the
 * handler and the "Reading..." state stayed on screen forever with no error.
 * The only way out was a page refresh.
 *
 * One helper, one shape of result, so a failure is always something the
 * caller can show rather than an exception nobody catches.
 */
export type ExtractResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; error: string };

export async function extractFileText(file: File): Promise<ExtractResult> {
  const formData = new FormData();
  formData.set("file", file);

  let res: Response;
  try {
    res = await fetch("/api/extract-text", { method: "POST", body: formData });
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }

  // A gateway timeout or a crash returns HTML, not JSON, so parsing is its
  // own failure case rather than an exception thrown into the caller.
  let payload: { text?: string; fileName?: string; error?: string };
  try {
    payload = await res.json();
  } catch {
    return {
      ok: false,
      error: res.ok
        ? "That file came back in a form we couldn't read."
        : "Couldn't read that file. Try a different format.",
    };
  }

  if (!res.ok) return { ok: false, error: payload.error || "Couldn't read that file." };
  if (!payload.text?.trim()) {
    return { ok: false, error: "That file looks empty, or the text couldn't be pulled out of it." };
  }
  return { ok: true, text: payload.text, fileName: payload.fileName || file.name };
}
