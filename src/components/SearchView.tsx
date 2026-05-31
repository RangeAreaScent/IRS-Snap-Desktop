import { useEffect, useRef, useState } from "react";
import { searchIRS } from "../api";
import { RecentStore, useRecentItems } from "../recents";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { CodeRow } from "./CodeRow";

interface Props {
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
  /** Mirror the query upward so the right-pane detail can highlight matches. */
  onQueryChange?: (query: string) => void;
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

export function SearchView({ selectedKey, onSelect, onQueryChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        <div className="result-summary">{summary}</div>
      )}

      <div className="list-scroll">
        {error && <div className="state-msg state-msg--error">{error}</div>}
        {!error && !trimmed && (
          <IdleContent
            recents={recents}
            onPickRecent={(id) => onSelect(id)}
            onPickHint={(q) => setQuery(q)}
            onClearRecent={() => RecentStore.clear()}
          />
        )}
        {!error && trimmed && !loading && results.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No results</p>
            <p>No IRC sections, forms, or publications match "{trimmed}".</p>
          </div>
        )}
        {results.map((item) => (
          <CodeRow
            key={item.id}
            item={item}
            selected={item.id === selectedKey}
            favorite={isFavorite(item.id)}
            onSelect={() => onSelect(item.id)}
            onToggleFavorite={() => toggleFavorite(item)}
          />
        ))}
      </div>
    </div>
  );
}

// ────── Idle content: Recently viewed + clickable hints ──────

interface IdleProps {
  recents: ReturnType<typeof useRecentItems>;
  onPickRecent: (compositeKey: string) => void;
  onPickHint: (query: string) => void;
  onClearRecent: () => void;
}

function IdleContent({ recents, onPickRecent, onPickHint, onClearRecent }: IdleProps) {
  return (
    <div className="idle-content">
      {recents.length > 0 && (
        <section className="idle-section">
          <div className="idle-section__head">
            <span className="idle-section__title">Recently viewed</span>
            <button className="idle-section__clear" onClick={onClearRecent}>
              Clear
            </button>
          </div>
          {recents.map((r) => {
            const badge =
              r.kind === "provision"
                ? "IRC"
                : r.kind === "form"
                ? "Form"
                : "Pub";
            const badgeClass =
              r.kind === "provision" ? "irc" : r.kind === "form" ? "form" : "pub";
            return (
              <button
                key={r.id}
                className="recent-row"
                onClick={() => onPickRecent(r.id)}
              >
                <span className={`badge badge--${badgeClass}`}>{badge}</span>
                <span className="recent-row__primary">{r.primaryNumber}</span>
                <span className="recent-row__head">{r.headlineText}</span>
              </button>
            );
          })}
        </section>
      )}
      <section className="idle-section">
        <div className="idle-section__head">
          <span className="idle-section__title">Try searching</span>
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
    </div>
  );
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
