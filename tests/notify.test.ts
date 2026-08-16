import { describe, it, expect } from "vitest";
import { badge, MAX_BADGE } from "@/lib/notify";

describe("badge", () => {
  it("shows nothing when there is nothing", () => {
    // An empty badge on a bell is a bell somebody checks and resents.
    expect(badge(0)).toBeNull();
    expect(badge(-1)).toBeNull();
  });

  it("shows the number while it is small enough to read", () => {
    expect(badge(1)).toBe("1");
    expect(badge(MAX_BADGE)).toBe(String(MAX_BADGE));
  });

  it("stops counting past the cap", () => {
    // The difference between 14 and 40 unread does not change what anybody
    // does next, and a three digit badge does not fit next to an icon.
    expect(badge(MAX_BADGE + 1)).toBe(`${MAX_BADGE}+`);
    expect(badge(400)).toBe(`${MAX_BADGE}+`);
  });
});
