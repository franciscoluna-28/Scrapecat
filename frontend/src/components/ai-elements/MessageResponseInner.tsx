"use client";

import { memo, type ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/src/shared/lib/utils";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const streamdownPlugins: NonNullable<
  ComponentProps<typeof Streamdown>["plugins"]
> = { cjk, math, mermaid };

// Model output is untrusted. Block images so prompt-injected markdown cannot
// beacon the viewer's browser to an external host.
const safeComponents: NonNullable<
  ComponentProps<typeof Streamdown>["components"]
> = {
  img: () => null,
};

const MessageResponseInner = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      plugins={streamdownPlugins}
      {...props}
      components={safeComponents}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponseInner.displayName = "MessageResponseInner";

export default MessageResponseInner;