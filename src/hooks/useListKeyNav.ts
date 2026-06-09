import { useEffect } from "react";

// IRS uses `id` (compositeKey) as the row identifier — items must expose an `id` string.
export function useListKeyNav<T extends { id: string }>(
  items: T[],
  selectedKey: string | null,
  onSelect: (id: string) => void,
) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (items.length === 0) return;

      // Yield to cmdk (command palette) when open — its dialog portals to body with [cmdk-root].
      if (document.querySelector("[cmdk-root]")) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable = tag === "input" || tag === "textarea";

      if (e.key === "ArrowDown") {
        if (inEditable) {
          e.preventDefault();
          target?.blur();
          onSelect(items[0].id);
          return;
        }
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === selectedKey);
        const next = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        onSelect(items[next].id);
      } else if (e.key === "ArrowUp") {
        if (inEditable) return;
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === selectedKey);
        const next = idx <= 0 ? 0 : idx - 1;
        onSelect(items[next].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedKey, onSelect]);

  useEffect(() => {
    if (!selectedKey) return;
    const el = document.querySelector(`[data-key="${cssEscape(selectedKey)}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [selectedKey]);
}

// compositeKey can contain "/" or other chars that break attribute selectors.
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/(["\\\]/])/g, "\\$1");
}
