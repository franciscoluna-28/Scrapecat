"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownEditor() {
  const [markdown, setMarkdown] = useState(
    '# Welcome to Markdown Editor\n\n## Features\n\n- **Bold text**\n- *Italic text*\n- `Code snippets`\n- [Links](https://example.com)\n\n## Lists\n\n1. First item\n2. Second item\n   - Nested item\n   - Another nested item\n\n## Code Block\n\n```javascript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n```\n\n## Quote\n\n> This is a blockquote\n\n## Table\n\n| Column 1 | Column 2 |\n|-----------|-----------|\n| Cell 1    | Cell 2    |\n| Cell 3    | Cell 4    |\n\n---\n*Happy editing!*',
  );

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
      <div className="flex-1 bg-background border rounded-lg p-4">
        <div className="h-full flex flex-col">
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="flex-1 p-3 bg-background border border-border rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Start typing markdown..."
            style={{ minHeight: "300px" }}
          />

        {/*   <div className="mt-3 pt-3 border-t border-border">
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Preview
            </h3>
            <div className="p-3 bg-muted/50 rounded text-sm prose max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2 [&_code]:font-mono [&_pre]:bg-muted [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
