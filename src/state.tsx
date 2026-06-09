import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { storeRead, storeWrite } from "./api";
import { useSettings } from "./settings";
import type {
  Collection,
  CollectionItem,
  Favorite,
  NoteMap,
  SearchResult,
} from "./types";

/** Free-tier capacity. Premium unlocks unlimited. */
export const FREE_FAVORITES_MAX = 15;
export const FREE_COLLECTIONS_MAX = 10;

function usePersistentState<T>(
  name: string,
  initial: T,
): [T, (updater: (prev: T) => T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    storeRead<T>(name)
      .then((data) => {
        if (data != null) setValue(data);
      })
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, [name]);

  useEffect(() => {
    if (!loaded.current) return;
    storeWrite(name, value).catch((e) =>
      console.error(`failed to persist ${name}:`, e),
    );
  }, [name, value]);

  const update = useCallback((updater: (prev: T) => T) => {
    setValue((prev) => updater(prev));
  }, []);

  return [value, update, ready];
}

/** Flatten a SearchResult into the Favorite/CollectionItem shape. */
export function toFavorite(item: SearchResult): Favorite {
  const now = Date.now();
  switch (item.kind) {
    case "provision":
      return {
        compositeKey: item.id,
        kind: "provision",
        primaryNumber: item.data.shortCitation,
        headlineText: item.data.heading,
        secondaryText: item.data.popularName ?? "",
        parentForm: null,
        addedAt: now,
      };
    case "form":
      return {
        compositeKey: item.id,
        kind: "form",
        primaryNumber: item.data.canonicalNumber,
        headlineText: item.data.title,
        secondaryText: item.data.parentForm ?? item.data.category,
        parentForm: item.data.parentForm,
        addedAt: now,
      };
    case "pub":
      return {
        compositeKey: item.id,
        kind: "pub",
        primaryNumber: `Pub ${item.data.pubNumber}`,
        headlineText: item.data.title,
        secondaryText: item.data.targetAudience ?? "",
        parentForm: null,
        addedAt: now,
      };
  }
}

interface AppData {
  ready: boolean;

  favorites: Favorite[];
  isFavorite: (compositeKey: string) => boolean;
  toggleFavorite: (item: SearchResult) => void;
  removeFavorite: (compositeKey: string) => void;

  collections: Collection[];
  createCollection: (name: string, iconSymbol: string) => string | null;
  renameCollection: (id: string, name: string, iconSymbol: string) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (id: string, item: SearchResult) => void;
  /** Bulk-add already-flattened Favorite/CollectionItem rows; dedupes by compositeKey. */
  addFavoritesToCollection: (id: string, items: Favorite[]) => void;
  removeFromCollection: (id: string, compositeKey: string) => void;
  removeManyFromCollection: (id: string, compositeKeys: string[]) => void;
  bulkRemoveFavorites: (compositeKeys: string[]) => void;
  isInCollection: (id: string, compositeKey: string) => boolean;

  notes: NoteMap;
  setNote: (compositeKey: string, text: string) => void;
  deleteNote: (compositeKey: string) => void;

  favoritesMax: number;
  collectionsMax: number;
  premiumPrompt: string | null;
  promptPremium: (message: string) => void;
  clearPremiumPrompt: () => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { unlocked } = useSettings();
  const [favorites, updateFavorites, favReady] = usePersistentState<Favorite[]>(
    "favorites",
    [],
  );
  const [collections, updateCollections, colReady] = usePersistentState<
    Collection[]
  >("collections", []);
  const [notes, updateNotes, notesReady] = usePersistentState<NoteMap>(
    "notes",
    {},
  );
  const [premiumPrompt, setPremiumPrompt] = useState<string | null>(null);

  const favoritesMax = unlocked ? Infinity : FREE_FAVORITES_MAX;
  const collectionsMax = unlocked ? Infinity : FREE_COLLECTIONS_MAX;

  const promptPremium = useCallback((message: string) => {
    setPremiumPrompt(message);
  }, []);
  const clearPremiumPrompt = useCallback(() => setPremiumPrompt(null), []);

  const isFavorite = useCallback(
    (compositeKey: string) =>
      favorites.some((f) => f.compositeKey === compositeKey),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (item: SearchResult) => {
      const exists = favorites.some((f) => f.compositeKey === item.id);
      if (!exists && favorites.length >= favoritesMax) {
        setPremiumPrompt(
          `The free plan keeps up to ${FREE_FAVORITES_MAX} favorites. ` +
            `Unlock unlimited favorites with premium.`,
        );
        return;
      }
      updateFavorites((prev) => {
        if (prev.some((f) => f.compositeKey === item.id)) {
          return prev.filter((f) => f.compositeKey !== item.id);
        }
        return [toFavorite(item), ...prev];
      });
    },
    [favorites, favoritesMax, updateFavorites],
  );

  const removeFavorite = useCallback(
    (compositeKey: string) => {
      updateFavorites((prev) =>
        prev.filter((f) => f.compositeKey !== compositeKey),
      );
    },
    [updateFavorites],
  );

  const createCollection = useCallback(
    (name: string, iconSymbol: string): string | null => {
      if (collections.length >= collectionsMax) {
        setPremiumPrompt(
          `The free plan keeps up to ${FREE_COLLECTIONS_MAX} collections. ` +
            `Unlock unlimited collections with premium.`,
        );
        return null;
      }
      const id = crypto.randomUUID();
      updateCollections((prev) => [
        ...prev,
        { id, name, iconSymbol, createdAt: Date.now(), items: [] },
      ]);
      return id;
    },
    [collections, collectionsMax, updateCollections],
  );

  const renameCollection = useCallback(
    (id: string, name: string, iconSymbol: string) => {
      updateCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name, iconSymbol } : c)),
      );
    },
    [updateCollections],
  );

  const deleteCollection = useCallback(
    (id: string) => {
      updateCollections((prev) => prev.filter((c) => c.id !== id));
    },
    [updateCollections],
  );

  const addToCollection = useCallback(
    (id: string, item: SearchResult) => {
      updateCollections((prev) =>
        prev.map((c) => {
          if (
            c.id !== id ||
            c.items.some((i) => i.compositeKey === item.id)
          ) {
            return c;
          }
          return { ...c, items: [...c.items, toFavorite(item) as CollectionItem] };
        }),
      );
    },
    [updateCollections],
  );

  const removeFromCollection = useCallback(
    (id: string, compositeKey: string) => {
      updateCollections((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                items: c.items.filter((i) => i.compositeKey !== compositeKey),
              }
            : c,
        ),
      );
    },
    [updateCollections],
  );

  const removeManyFromCollection = useCallback(
    (id: string, compositeKeys: string[]) => {
      if (compositeKeys.length === 0) return;
      const keySet = new Set(compositeKeys);
      updateCollections((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, items: c.items.filter((i) => !keySet.has(i.compositeKey)) }
            : c,
        ),
      );
    },
    [updateCollections],
  );

  const addFavoritesToCollection = useCallback(
    (id: string, items: Favorite[]) => {
      if (items.length === 0) return;
      updateCollections((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const existing = new Set(c.items.map((i) => i.compositeKey));
          const additions = items
            .filter((i) => !existing.has(i.compositeKey))
            .map((i) => ({ ...i }) as CollectionItem);
          if (additions.length === 0) return c;
          return { ...c, items: [...c.items, ...additions] };
        }),
      );
    },
    [updateCollections],
  );

  const bulkRemoveFavorites = useCallback(
    (compositeKeys: string[]) => {
      if (compositeKeys.length === 0) return;
      const keySet = new Set(compositeKeys);
      updateFavorites((prev) => prev.filter((f) => !keySet.has(f.compositeKey)));
    },
    [updateFavorites],
  );

  const isInCollection = useCallback(
    (id: string, compositeKey: string) =>
      collections
        .find((c) => c.id === id)
        ?.items.some((i) => i.compositeKey === compositeKey) ?? false,
    [collections],
  );

  const setNote = useCallback(
    (compositeKey: string, text: string) => {
      updateNotes((prev) => ({
        ...prev,
        [compositeKey]: { text, editedAt: Date.now() },
      }));
    },
    [updateNotes],
  );

  const deleteNote = useCallback(
    (compositeKey: string) => {
      updateNotes((prev) => {
        const next = { ...prev };
        delete next[compositeKey];
        return next;
      });
    },
    [updateNotes],
  );

  return (
    <AppDataContext.Provider
      value={{
        ready: favReady && colReady && notesReady,
        favorites,
        isFavorite,
        toggleFavorite,
        removeFavorite,
        collections,
        createCollection,
        renameCollection,
        deleteCollection,
        addToCollection,
        addFavoritesToCollection,
        removeFromCollection,
        removeManyFromCollection,
        bulkRemoveFavorites,
        isInCollection,
        notes,
        setNote,
        deleteNote,
        favoritesMax,
        collectionsMax,
        premiumPrompt,
        promptPremium,
        clearPremiumPrompt,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
