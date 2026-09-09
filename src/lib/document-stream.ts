import { get } from "@vercel/blob";

/**
 * Handing a file to somebody who has been checked.
 *
 * The store is private, so there is no URL to redirect to: the bytes are
 * fetched here and streamed straight through. Shared by the two routes that
 * can reach a document, because the difference between them is only who is
 * allowed, and the part after that should not be written twice.
 *
 * Streamed rather than buffered. A 10 MB file read into memory on a
 * serverless function is 10 MB of memory per concurrent download for no
 * benefit, when the response is going out of the same process it came in.
 */
export interface StreamableDocument {
  pathname: string;
  name: string;
  contentType: string;
}

export async function documentResponse(doc: StreamableDocument): Promise<Response> {
  const found = await get(doc.pathname, { access: "private" });
  if (!found) return new Response("Not found", { status: 404 });

  return new Response(found.stream, {
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      /*
       * inline, with the name the person gave it.
       *
       * A PDF or an image opens in the browser, which is what somebody
       * clicking a document on a page expects; anything the browser cannot
       * display falls back to downloading on its own. The filename is quoted
       * and stripped of quotes and newlines, because it is text somebody
       * typed and this header is parsed.
       */
      "Content-Disposition": `inline; filename="${doc.name.replace(/["\\\r\n]/g, "")}"`,
      /*
       * Private and short.
       *
       * A shared cache holding this would serve it to the next person asking
       * for the same URL without the checks running again, and access here
       * depends on a project still being published, which can change at any
       * moment.
       */
      "Cache-Control": "private, max-age=60",
    },
  });
}
