import { useEffect, useMemo, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { searchIRS } from "../api";
import { RecentStore, useRecentItems, type RecentItem } from "../recents";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { CodeRow } from "./CodeRow";
import { useListKeyNav } from "../hooks/useListKeyNav";

interface Props {
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
  /** Mirror the query upward so the right-pane detail can highlight matches. */
  onQueryChange?: (query: string) => void;
  /** Surface the full SearchResult so App.tsx can wire ⌘D toggleFavorite. */
  onSelectItem?: (item: SearchResult) => void;
}

const HINTS: Array<[string, string]> = [
  ["1040",        "Individual Income Tax Return"],
  ["W-2",         "Wage and Tax Statement"],
  ["1099-NEC",    "Nonemployee Compensation"],
  ["Schedule C",  "Profit or Loss From Business"],
  ["Schedule SE", "Self-Employment Tax"],
  ["199A",        "QBI Deduction"],
  ["Pub 17",      "Federal Income Tax (Individuals)"],
  ["depreciation","FTS5 across body text"],
];

type SortKey = "relevance" | "citation";

export function SearchView({ selectedKey, onSelect, onQueryChange, onSelectItem }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const { isFavorite, toggleFavorite } = useAppData();
  const recents = useRecentItems();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search with stale-response guard.
  const runId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++runId.current;
    const timer = setTimeout(() => {
      searchIRS(trimmed)
        .then((res) => {
          if (id !== runId.current) return;
          setResults(res);
          setError(null);
        })
        .catch((e) => {
          if (id !== runId.current) return;
          setError(String(e));
          setResults([]);
        })
        .finally(() => {
          if (id === runId.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = query.trim();
  const summary = useSummary(results);

  // Whenever the selection lands on a row we have full data for, push the
  // SearchResult up so App.tsx can wire ⌘D toggleFavorite without re-fetching.
  // We check live results first, then the recents list (since ↑↓ in the
  // idle state walks recents); both produce a fully-formed SearchResult.
  useEffect(() => {
    if (!selectedKey) return;
    const fromResults = results.find((r) => r.id === selectedKey);
    if (fromResults) {
      onSelectItem?.(fromResults);
      return;
    }
    const fromRecent = recents.find((r) => r.id === selectedKey);
    if (fromRecent) onSelectItem?.(recentToSearchResult(fromRecent));
  }, [selectedKey, results, recents, onSelectItem]);

  // Freeze recents during navigation — RecentStore re-orders on every detail
  // view, which would otherwise make ↑↓ ping-pong between two items. Only
  // refresh the snapshot when the set of ids actually changes.
  const [stableRecents, setStableRecents] = useState<RecentItem[]>(recents);
  useEffect(() => {
    setStableRecents((prev) => {
      if (prev.length !== recents.length) return recents;
      const prevSet = new Set(prev.map((r) => r.id));
      const hasNew = recents.some((r) => !prevSet.has(r.id));
      return hasNew ? recents : prev;
    });
  }, [recents]);

  // Sort once at the view level. Relevance keeps the FTS5 order returned by
  // Rust; citation sorts the primary string with numeric collation so
  // "17" precedes "1040" and "199A" precedes "501".
  const sortedResults = useMemo<SearchResult[]>(() => {
    if (sortBy === "relevance") return results;
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return [...results].sort((a, b) =>
      collator.compare(primaryOf(a), primaryOf(b)),
    );
  }, [results, sortBy]);

  const navItems = useMemo<{ id: string }[]>(
    () => (trimmed ? sortedResults : stableRecents.map((r) => ({ id: r.id }))),
    [trimmed, sortedResults, stableRecents],
  );
  useListKeyNav(navItems, selectedKey, onSelect);

  return (
    <div className="list-pane">
      <div className="search-bar">
        <span className="search-bar__icon">⌕</span>
        <input
          ref={inputRef}
          className="search-bar__input"
          placeholder="Search IRC §, Form, or Pub…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <button
            className="search-bar__clear"
            onClick={() => setQuery("")}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {!error && trimmed && !loading && results.length > 0 && (
        <div className="result-summary">
          <span>{summary}</span>
          <div className="sort-bar" role="tablist">
            <button
              role="tab"
              aria-selected={sortBy === "relevance"}
              className={`sort-bar__btn${
                sortBy === "relevance" ? " sort-bar__btn--on" : ""
              }`}
              onClick={() => setSortBy("relevance")}
            >
              Relevance
            </button>
            <button
              role="tab"
              aria-selected={sortBy === "citation"}
              className={`sort-bar__btn${
                sortBy === "citation" ? " sort-bar__btn--on" : ""
              }`}
              onClick={() => setSortBy("citation")}
            >
              Citation
            </button>
          </div>
        </div>
      )}

      <div className="list-scroll">
        {error && <div className="state-msg state-msg--error">{error}</div>}
        {!error && !trimmed && (
          <IdleContent
            recents={stableRecents}
            selectedKey={selectedKey}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onPickRecent={(id, item) => {
              onSelect(id);
              onSelectItem?.(item);
            }}
            onPickHint={(q) => setQuery(q)}
            onClearRecent={async () => {
              const ok = await ask(
                "Clear all recently viewed items? This cannot be undone.",
                { title: "Clear recently viewed", kind: "warning" },
              );
              if (ok) RecentStore.clear();
            }}
          />
        )}
        {!error && trimmed && !loading && results.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No results</p>
            <p>No IRC sections, forms, or publications match "{trimmed}".</p>
          </div>
        )}
        {!error && trimmed &&
          sortedResults.map((item) => (
            <CodeRow
              key={item.id}
              item={item}
              selected={item.id === selectedKey}
              favorite={isFavorite(item.id)}
              onSelect={() => {
                onSelect(item.id);
                onSelectItem?.(item);
              }}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          ))}
      </div>
    </div>
  );
}

// ────── Idle content: Recently viewed + clickable hints ──────

interface IdleProps {
  recents: RecentItem[];
  selectedKey: string | null;
  isFavorite: (compositeKey: string) => boolean;
  toggleFavorite: (item: SearchResult) => void;
  /** Receives the synthetic SearchResult so App.tsx can ⌘D-toggle it. */
  onPickRecent: (compositeKey: string, item: SearchResult) => void;
  onPickHint: (query: string) => void;
  onClearRecent: () => void;
}

function IdleContent({
  recents,
  selectedKey,
  isFavorite,
  toggleFavorite,
  onPickRecent,
  onPickHint,
  onClearRecent,
}: IdleProps) {
  const hasRecents = recents.length > 0;
  return (
    <div className="idle-content">
      {hasRecents ? (
        <section className="idle-section">
          <div className="recent-head">
            <span className="recent-head__title">Recently viewed</span>
            <button
              className="recent-head__action"
              onClick={onClearRecent}
              title="Clear recently viewed"
            >
              Clear
            </button>
          </div>
          {recents.map((r) => {
            const item = recentToSearchResult(r);
            return (
              <CodeRow
                key={r.id}
                item={item}
                selected={r.id === selectedKey}
                favorite={isFavorite(r.id)}
                onSelect={() => onPickRecent(r.id, item)}
                onToggleFavorite={() => toggleFavorite(item)}
              />
            );
          })}
        </section>
      ) : (
        // First-run scaffolding — hidden once the user has any recent
        // activity so the idle list stays focused (Tariff pattern).
        <section className="idle-section">
          <div className="recent-head">
            <span className="recent-head__title">Try searching</span>
          </div>
          {HINTS.map(([q, desc]) => (
            <button
              key={q}
              className="hint-row"
              onClick={() => onPickHint(q)}
            >
              <span className="hint-row__query">{q}</span>
              <span className="hint-row__dash">—</span>
              <span className="hint-row__desc">{desc}</span>
              <span className="hint-row__arrow">↖</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

/* Recent items carry just enough fields to reconstruct a SearchResult shape
   so they render in the same CodeRow as live search hits — matches Tariff's
   unified-row pattern. The synthetic SearchResult is also fine for
   toggleFavorite because it carries the right composite key + display
   strings (toFavorite() reads .data.shortCitation / .canonicalNumber /
   .pubNumber + .heading / .title / .targetAudience). */
function recentToSearchResult(r: RecentItem): SearchResult {
  if (r.kind === "form") {
    const isSchedule = /^schedule\b/i.test(r.primaryNumber);
    return {
      kind: "form",
      id: r.id,
      data: {
        canonicalNumber: r.primaryNumber,
        category: isSchedule ? "schedule" : "form",
        parentForm: r.parentForm,
        title: r.headlineText,
        rawProductNumber: r.primaryNumber,
      },
    };
  }
  if (r.kind === "pub") {
    return {
      kind: "pub",
      id: r.id,
      data: {
        pubNumber: r.primaryNumber.replace(/^Pub\s+/i, ""),
        title: r.headlineText,
        targetAudience: r.secondaryText || null,
      },
    };
  }
  const source: "usc" | "cfr" = r.id.startsWith("p:cfr-") ? "cfr" : "usc";
  return {
    kind: "provision",
    id: r.id,
    data: {
      provisionId: r.id.replace(/^p:/, ""),
      source,
      sectionNumber: r.primaryNumber,
      heading: r.headlineText,
      bodyExcerpt: "",
      shortCitation: r.primaryNumber,
      popularName: r.secondaryText || null,
    },
  };
}

function primaryOf(item: SearchResult): string {
  switch (item.kind) {
    case "provision": return item.data.shortCitation;
    case "form": return item.data.canonicalNumber;
    case "pub": return item.data.pubNumber;
  }
}

function useSummary(results: SearchResult[]): string {
  let irc = 0,
    form = 0,
    pub = 0;
  for (const r of results) {
    if (r.kind === "provision") irc++;
    else if (r.kind === "form") form++;
    else pub++;
  }
  const parts: string[] = [`${results.length} result${results.length === 1 ? "" : "s"}`];
  if (irc) parts.push(`${irc} IRC`);
  if (form) parts.push(`${form} Form`);
  if (pub) parts.push(`${pub} Pub`);
  return parts.join(" · ");
}
