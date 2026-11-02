"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";

const ScrollContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(
  null,
);

/**
 * Owns the dashboard's scroll container so features can scroll it without
 * reaching into the layout DOM. The ref is stable for the provider's lifetime.
 */
export function ScrollContainerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <ScrollContainerContext.Provider value={ref}>
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}

export function useScrollContainer(): RefObject<HTMLDivElement | null> {
  const context = useContext(ScrollContainerContext);
  if (!context) {
    throw new Error("useScrollContainer must be used within ScrollContainerProvider");
  }
  return context;
}
