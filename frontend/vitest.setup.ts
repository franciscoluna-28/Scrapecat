import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver, which Radix (ScrollArea, etc.) uses.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
