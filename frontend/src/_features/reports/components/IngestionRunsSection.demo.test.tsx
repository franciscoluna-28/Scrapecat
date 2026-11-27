import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseIngestionRuns = vi.hoisted(() => vi.fn());

vi.mock("@/src/shared/constants", () => ({ IS_DEMO: true }));
vi.mock("@/src/_features/reports/services/reports-api", () => ({
  useIngestionRuns: mockUseIngestionRuns,
}));

import { IngestionRunsSection } from "./IngestionRunsSection";

describe("IngestionRunsSection in demo mode", () => {
  it("renders nothing and skips the query", () => {
    const { container } = render(<IngestionRunsSection />);

    expect(container).toBeEmptyDOMElement();
    expect(mockUseIngestionRuns).not.toHaveBeenCalled();
  });
});
