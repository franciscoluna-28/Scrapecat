import { describe, it, expect } from "vitest";
import { extractImagesFromPrBody } from "@/shared/utils";

describe("extractImagesFromPrBody", () => {
  const sha = "abc123";
  const message = "fix: typo";

  it("extracts markdown images", () => {
    const body = "Some text\n![screenshot](https://example.com/img.png)\nmore text";
    const result = extractImagesFromPrBody(body, sha, message);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      url: "https://example.com/img.png",
      alt: "screenshot",
      commitSha: sha,
      commitMessage: message,
    });
  });

  it("extracts HTML img tags", () => {
    const body = '<img src="https://example.com/photo.jpg" alt="photo" />';
    const result = extractImagesFromPrBody(body, sha, message);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/photo.jpg");
  });

  it("returns empty array when no images", () => {
    const result = extractImagesFromPrBody("just text, no images", sha, message);
    expect(result).toEqual([]);
  });

  it("extracts multiple images", () => {
    const body = "![a](https://a.png) text ![b](https://b.png)";
    const result = extractImagesFromPrBody(body, sha, message);
    expect(result).toHaveLength(2);
  });
});
