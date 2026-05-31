/**
 * Wrap each case-insensitive match of `query` inside the source text with a
 * <mark> element so detail bodies can highlight the user's search query.
 * Tokens shorter than 2 chars are ignored (FTS5 alignment).
 *
 * Returns a React fragment — safe to drop into any text container.
 */
import type { ReactNode } from "react";

export function highlight(text: string, query: string): ReactNode {
  const tokens = (query ?? "")
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return text;

  // Build one regex with alternation. Escape regex metachars.
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(re);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <mark key={i} className="hl">
          {part}
        </mark>
      );
    }
    return part;
  });
}
