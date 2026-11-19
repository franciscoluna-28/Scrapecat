import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar, SidebarProvider, SidebarMenu } from "@/src/components/ui/sidebar";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { GITHUB_STAR_URL } from "@/src/shared/constants";
import { StarOnGitHubLink } from "./StarOnGitHubLink";

describe("StarOnGitHubLink", () => {
  it("links to the GitHub repository in a new tab", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <StarOnGitHubLink />
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>,
    );

    const link = screen.getByRole("link", { name: /star on github/i });

    expect(link).toHaveAttribute("href", GITHUB_STAR_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });
});
