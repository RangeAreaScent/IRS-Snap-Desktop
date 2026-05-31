import { useEffect, useRef, useState } from "react";
import { searchIRS } from "../api";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { Modal } from "./Modal";

interface Props {
  collectionId: string;
  onClose: () => void;
}

export function AddCodeModal({ collectionId, onClose }: Props) {
  const { addToCollection, removeFromCollection, isInCollection } = useAppData();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const runId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const id = ++runId.current;
    const timer = setTimeout(() => {
      searchIRS(trimmed, 30)
        .then((res) => {
          if (id === runId.current) setResults(res);
        })
        .catch((e) => console.error("search failed:", e));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal
      title="Add item"
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <input
        className="text-input"
        autoFocus
        placeholder="Search IRC §, Form, or Pub…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
      />
      <div className="pick-list pick-list--tall">
        {results.map((r) => {
          const inside = isInCollection(collectionId, r.id);
          const { primary, secondary } = presentForPick(r);
          return (
            <button
              key={r.id}
              className="pick-row"
              onClick={() =>
                inside
                  ? removeFromCollection(collectionId, r.id)
                  : addToCollection(collectionId, r)
              }
            >
              <span className="pick-row__code">{primary}</span>
              <span className="pick-row__name">{secondary}</span>
              <span className="pick-row__check">{inside ? "✓" : "＋"}</span>
            </button>
          );
        })}
        {query.trim() && results.length === 0 && (
          <p className="modal-empty">No results.</p>
        )}
      </div>
    </Modal>
  );
}

function presentForPick(r: SearchResult): { primary: string; secondary: string } {
  switch (r.kind) {
    case "provision":
      return { primary: r.data.shortCitation, secondary: r.data.heading };
    case "form": {
      const parent = r.data.parentForm;
      const primary =
        r.data.category === "schedule" && parent
          ? `${r.data.canonicalNumber} (${parent})`
          : r.data.canonicalNumber;
      return { primary, secondary: r.data.title };
    }
    case "pub":
      return { primary: `Pub ${r.data.pubNumber}`, secondary: r.data.title };
  }
}
