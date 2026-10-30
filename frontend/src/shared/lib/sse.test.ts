import { describe, it, expect } from "vitest";
import { parseSseBuffer, parseSseFrame } from "./sse";

describe("parseSseBuffer", () => {
  it("splits complete frames and keeps the trailing partial", () => {
    const { frames, rest } = parseSseBuffer("data: a\n\ndata: b\n\ndata: par");
    expect(frames).toEqual(["data: a", "data: b"]);
    expect(rest).toBe("data: par");
  });

  it("returns everything as rest when no blank-line separator exists yet", () => {
    const { frames, rest } = parseSseBuffer("data: a");
    expect(frames).toEqual([]);
    expect(rest).toBe("data: a");
  });

  it("handles a buffer ending on a boundary", () => {
    const { frames, rest } = parseSseBuffer("data: a\n\n");
    expect(frames).toEqual(["data: a"]);
    expect(rest).toBe("");
  });
});

describe("parseSseFrame", () => {
  it("parses a data line into an object", () => {
    expect(parseSseFrame('data: {"type":"token","content":"hi"}')).toEqual({
      type: "token",
      content: "hi",
    });
  });

  it("tolerates a space after the colon and surrounding whitespace", () => {
    expect(parseSseFrame('  data:  {"n":1}  ')).toEqual({ n: 1 });
  });

  it("returns null for malformed JSON", () => {
    expect(parseSseFrame("data: {not json")).toBeNull();
  });

  it("returns null when there is no data line", () => {
    expect(parseSseFrame("event: ping")).toBeNull();
  });

  it("ignores heartbeat comment frames", () => {
    expect(parseSseFrame(": ping")).toBeNull();
  });

  it("ignores the retry preamble", () => {
    expect(parseSseFrame("retry: 3000")).toBeNull();
  });

  it("ignores non-data lines before the data line", () => {
    expect(parseSseFrame('event: token\ndata: {"type":"done"}')).toEqual({ type: "done" });
  });
});
