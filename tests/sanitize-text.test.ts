import { describe, it, expect } from "vitest";
import { sanitizeText } from "@/lib/sanitize-text";

/**
 * Regression cover for the failure that took down quote generation: text
 * extracted from a real PDF contained NUL bytes, and Postgres rejects those
 * outright ("22021: invalid byte sequence for encoding UTF8: 0x00"), so the
 * insert failed after the slow generation had already completed.
 *
 * The control characters here are written as escapes on purpose. Embedding
 * them literally makes the test look like it is asserting that a string
 * equals itself, since they are invisible in an editor.
 */
describe("sanitizeText", () => {
  it("strips NUL bytes, which Postgres rejects outright", () => {
    expect(sanitizeText("Acme \u0000Rebrand")).toBe("Acme Rebrand");
  });

  it("strips NULs wherever they appear, including runs of them", () => {
    expect(sanitizeText("\u0000\u0000lead")).toBe("lead");
    expect(sanitizeText("trail\u0000\u0000")).toBe("trail");
    expect(sanitizeText("\u0000")).toBe("");
  });

  it("keeps tabs, newlines and carriage returns, which are meaningful", () => {
    expect(sanitizeText("a\tb\nc\r\nd")).toBe("a\tb\nc\r\nd");
  });

  it("strips the other C0 controls that render as garbage", () => {
    expect(sanitizeText("a\u0001b\u0007c\u001Fd")).toBe("abcd");
  });

  it("leaves ordinary text, punctuation and non-ASCII untouched", () => {
    const text = "Rebrand for Cafe Ltd. Budget: £4,000 (50% up front) - phase 1.";
    expect(sanitizeText(text)).toBe(text);
  });

  it("leaves an empty string alone", () => {
    expect(sanitizeText("")).toBe("");
  });
});
