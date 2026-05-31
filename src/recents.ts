/**
 * Recent-items store — last-N viewed provisions/forms/pubs persisted to
 * localStorage so the list survives app restarts. SearchView shows them
 * above the empty-state hints.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "irssnap.recentItems.v1";
const MAX_COUNT = 20;

export interface RecentItem {
  /** compositeKey — matches `SearchResult.id` ("p:..." / "f:..." / "u:..."). */
  id: string;
  /** "provision" | "form" | "pub" */
  kind: string;
  primaryNumber: string;
  headlineText: string;
  secondaryText: string;
  parentForm: string | null;
}

function load(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

function persist(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("RecentItems persist failed:", e);
  }
}

// Singleton store + simple subscriber registry so multiple views (Search +
// Settings "Clear") stay in sync without a context provider.
let _items: RecentItem[] = load();
const listeners = new Set<(items: RecentItem[]) => void>();

function notify() {
  for (const l of listeners) l(_items);
}

export const RecentStore = {
  items: () => _items,

  add(item: RecentItem) {
    const filtered = _items.filter((i) => i.id !== item.id);
    filtered.unshift(item);
    _items = filtered.slice(0, MAX_COUNT);
    persist(_items);
    notify();
  },

  clear() {
    _items = [];
    persist(_items);
    notify();
  },

  subscribe(fn: (items: RecentItem[]) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Hook — re-renders when the recent list changes. */
export function useRecentItems(): RecentItem[] {
  const [items, setItems] = useState<RecentItem[]>(RecentStore.items());
  useEffect(() => RecentStore.subscribe(setItems), []);
  return items;
}
