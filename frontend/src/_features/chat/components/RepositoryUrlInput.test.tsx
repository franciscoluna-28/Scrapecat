import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepositoryUrlInput } from "./RepositoryUrlInput";

function setup(overrides: Partial<React.ComponentProps<typeof RepositoryUrlInput>> = {}) {
  const props = {
    value: "owner/repo",
    onValueChange: vi.fn(),
    onConnect: vi.fn(),
    connecting: false,
    error: null,
    ...overrides,
  };
  render(<RepositoryUrlInput {...props} />);
  return props;
}

describe("RepositoryUrlInput", () => {
  it("renders the current value and forwards typing", async () => {
    const props = setup();
    const input = screen.getByPlaceholderText(/Paste a GitHub URL/i);
    expect(input).toHaveValue("owner/repo");
    await userEvent.type(input, "x");
    expect(props.onValueChange).toHaveBeenCalled();
  });

  it("calls onConnect when Connect is clicked", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(props.onConnect).toHaveBeenCalledTimes(1);
  });

  it("calls onConnect when Enter is pressed", async () => {
    const props = setup({ value: "" });
    await userEvent.type(screen.getByPlaceholderText(/Paste a GitHub URL/i), "{Enter}");
    expect(props.onConnect).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when present", () => {
    setup({ error: "Enter a valid GitHub URL" });
    expect(screen.getByText("Enter a valid GitHub URL")).toBeInTheDocument();
  });

  it("disables the button while connecting", () => {
    setup({ connecting: true });
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });
});
