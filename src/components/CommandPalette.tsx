import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { searchIRS } from "../api";
import { RecentStore, useRecentItems } from "../recents";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { showToast } from "./Toaster";

interface Props {
  open: boolean;
  onClose: () => void;
  onJumpToKey: (compositeKey: string) => void;
  onJumpToTab: (tab: "search" | "favorites" | "collections" | "settings") => void;
}

const CODES_MIN_QUERY = 2;
const CODES_MAX = 5;
const RECENT_MAX = 3;
const FAV_MAX = 3;

export function CommandPalette({ open, onClose, onJumpToKey, onJumpToTab }: Props) {
  const [query, setQuery] = useState("");
  const [codeHits, setCodeHits] = useState<SearchResult[]>([]);
  const recents = useRecentItems();
  const { favorites } = useAppData();

  // Reset query when the palette closes — every open starts fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Debounced code search. Only fires once the query is long enough to be
  // selective — 1-char queries match too many provisions to be useful.
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < CODES_MIN_QUERY) {
      setCodeHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchIRS(trimmed, CODES_MAX)
        .then((res) => {
          if (!cancelled) setCodeHits(res.slice(0, CODES_MAX));
        })
        .catch(() => {
          if (!cancelled) setCodeHits([]);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  const trimmed = query.trim();
  const showIdleGroups = trimmed.length === 0;

  function pickItem(key: string) {
    onClose();
    onJumpToKey(key);
  }

  function pickTab(t: "search" | "favorites" | "collections" | "settings") {
    onClose();
    onJumpToTab(t);
  }

  function clearRecents() {
    onClose();
    RecentStore.clear();
    showToast("Recently viewed cleared");
  }

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        // cmdk renders to body via portal; this overlay sits behind the dialog.
        // Attribute selector lets styles.css target it without a className race.
        {...{ "cmdk-overlay": "" }}
      />
      <Command
        label="Command palette"
        className="cmdk-root"
        // Make cmdk forward Esc to our handler — its default behaviour just
        // blurs the input which leaves the dialog open.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search the IRS code, jump to a tab, or run an action…"
          className="cmdk-input"
        />
        <Command.List className="cmdk-list">
          <Command.Empty className="cmdk-empty">No matches.</Command.Empty>

          {trimmed.length >= CODES_MIN_QUERY && codeHits.length > 0 && (
            <Command.Group heading="Code" className="cmdk-group">
              {codeHits.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`code ${item.id} ${primaryOf(item)} ${headlineOf(item)}`}
                  onSelect={() => pickItem(item.id)}
                  className="cmdk-item"
                >
                  <span className="cmdk-item__primary">{primaryOf(item)}</span>
                  <span className="cmdk-item__secondary">{headlineOf(item)}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {showIdleGroups && recents.length > 0 && (
            <Command.Group heading="Recent" className="cmdk-group">
              {recents.slice(0, RECENT_MAX).map((r) => (
                <Command.Item
                  key={`recent:${r.id}`}
                  value={`recent ${r.primaryNumber} ${r.headlineText}`}
                  onSelect={() => pickItem(r.id)}
                  className="cmdk-item"
                >
                  <span className="cmdk-item__primary">{r.primaryNumber}</span>
                  <span className="cmdk-item__secondary">{r.headlineText}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {showIdleGroups && favorites.length > 0 && (
            <Command.Group heading="Favorites" className="cmdk-group">
              {favorites.slice(0, FAV_MAX).map((f) => (
                <Command.Item
                  key={`fav:${f.compositeKey}`}
                  value={`favorite favourite ${f.primaryNumber} ${f.headlineText}`}
                  onSelect={() => pickItem(f.compositeKey)}
                  className="cmdk-item"
                >
                  <span className="cmdk-item__primary">{f.primaryNumber}</span>
                  <span className="cmdk-item__secondary">{f.headlineText}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Go to" className="cmdk-group">
            <Command.Item
              value="go to search find lookup"
              onSelect={() => pickTab("search")}
              className="cmdk-item"
            >
              <span className="cmdk-item__primary">Search</span>
              <kbd className="cmdk-item__shortcut">⌘1</kbd>
            </Command.Item>
            <Command.Item
              value="go to favorites favourites starred saved"
              onSelect={() => pickTab("favorites")}
              className="cmdk-item"
            >
              <span className="cmdk-item__primary">Favorites</span>
              <kbd className="cmdk-item__shortcut">⌘2</kbd>
            </Command.Item>
            <Command.Item
              value="go to collections lists folders"
              onSelect={() => pickTab("collections")}
              className="cmdk-item"
            >
              <span className="cmdk-item__primary">Collections</span>
              <kbd className="cmdk-item__shortcut">⌘3</kbd>
            </Command.Item>
            <Command.Item
              value="go to settings preferences theme"
              onSelect={() => pickTab("settings")}
              className="cmdk-item"
            >
              <span className="cmdk-item__primary">Settings</span>
              <kbd className="cmdk-item__shortcut">⌘,</kbd>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Actions" className="cmdk-group">
            <Command.Item
              value="clear recently viewed history reset recents"
              onSelect={clearRecents}
              className="cmdk-item"
            >
              <span className="cmdk-item__primary">Clear recently viewed</span>
              <span className="cmdk-item__secondary">
                Reset the Recent list
              </span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </>
  );
}

function primaryOf(item: SearchResult): string {
  switch (item.kind) {
    case "provision": return item.data.shortCitation;
    case "form": return item.data.canonicalNumber;
    case "pub": return `Pub ${item.data.pubNumber}`;
  }
}

function headlineOf(item: SearchResult): string {
  switch (item.kind) {
    case "provision": return item.data.heading;
    case "form": return item.data.title;
    case "pub": return item.data.title;
  }
}
