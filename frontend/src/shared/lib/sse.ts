/**
 * Minimal server-sent-events parsing helpers, kept pure so they can be unit
 * tested without a network stream.
 *
 * An SSE payload is a sequence of frames separated by a blank line. Each frame
 * is one or more lines; we only use the `data:` field.
 */

export function parseSseBuffer(buffer: string): { frames: string[]; rest: string } {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  return { frames: chunks, rest };
}

/**
 * Extracts and JSON-parses the `data:` payload of a single frame. Returns null
 * for frames with no data line or malformed JSON (both are skipped by callers).
 */
export function parseSseFrame(frame: string): unknown | null {
  for (const line of frame.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.replace(/^data:\s*/, "");
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return null;
}
