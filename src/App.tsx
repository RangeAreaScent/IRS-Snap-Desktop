import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./styles.css";
import { CodeDetailView } from "./components/CodeDetailView";
import { CollectionsView } from "./components/CollectionsView";
import { FavoritesView } from "./components/FavoritesView";
import { OnboardingView } from "./components/OnboardingView";
import { PremiumPromptModal } from "./components/PremiumPromptModal";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { CommandPalette } from "./components/CommandPalette";
import { Splitter } from "./components/Splitter";
import { StatusBar } from "./components/StatusBar";
import { Toaster, showToast } from "./components/Toaster";
import { AppDataProvider, useAppData } from "./state";
import { SettingsProvider, useSettings } from "./settings";
import type { SearchResult } from "./types";

const NARROW_PX = 900;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_PX,
  );
  useEffect(() => {
    function onResize() {
      setNarrow(window.innerWidth < NARROW_PX);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

type Tab = "search" | "favorites" | "collections" | "settings";

function App() {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </SettingsProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>("search");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isNarrow = useIsNarrow();
  const [narrowDetailOpen, setNarrowDetailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { premiumPrompt, clearPremiumPrompt, isFavorite, toggleFavorite, removeFavorite, favorites } =
    useAppData();
  const { hasSeenOnboarding, dismissOnboarding } = useSettings();

  // In narrow mode every selection opens the detail overlay; in split mode
  // the detail already shares the screen so no state flip needed.
  const handleSelect = useCallback(
    (key: string) => {
      setSelectedKey(key);
      if (window.innerWidth < NARROW_PX) setNarrowDetailOpen(true);
    },
    [],
  );

  // Reset the overlay whenever the user switches tabs — otherwise the old
  // selection's detail sticks around above the new tab's list.
  useEffect(() => {
    setNarrowDetailOpen(false);
  }, [tab]);

  // Native menu → React action bridge. menu.rs emits `menu:<id>` events;
  // we wire each one to the same action the keyboard shortcut runs. Effect
  // depends on selectedKey so the copy-citation handler reads the latest.
  useEffect(() => {
    const unlistens: Array<Promise<() => void>> = [];
    function on(id: string, fn: () => void) {
      unlistens.push(listen(`menu:${id}`, fn));
    }

    function focusSearchInput() {
      setTab("search");
      setTimeout(() => {
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }, 0);
    }

    on("app.preferences", () => setTab("settings"));
    on("file.new_search", focusSearchInput);
    on("file.command_palette", () => setPaletteOpen(true));
    on("file.export_collection", () => {
      // Re-dispatch as a keydown so CollectionsView's own ⌘E listener picks
      // it up — keeps a single source of truth for "what does ⌘E do here?".
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true }),
      );
    });
    on("edit.copy_citation", () => {
      if (!selectedKey) return;
      const el = document.querySelector(
        `[data-key="${cssEscape(selectedKey)}"] .code-row__code, [data-key="${cssEscape(selectedKey)}"] .recent-row__primary`,
      ) as HTMLElement | null;
      const text = el?.textContent?.trim();
      if (text) {
        void navigator.clipboard.writeText(text).then(() => {
          showToast(`Copied ${text}`);
        });
      }
    });
    on("edit.find", focusSearchInput);
    on("view.tab_search", () => setTab("search"));
    on("view.tab_favorites", () => setTab("favorites"));
    on("view.tab_collections", () => setTab("collections"));
    on("view.tab_settings", () => setTab("settings"));
    on("view.reset_splitter", () => {
      try {
        localStorage.removeItem("snap.listWidth");
      } catch {}
      document.documentElement.style.removeProperty("--list-width");
      showToast("Splitter width reset");
    });
    on("help.how_to_use", () => setTab("settings"));
    on("help.database", () => setTab("settings"));

    return () => {
      unlistens.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, [selectedKey]);

  // Esc priority: palette > narrow overlay > Search input focus.
  // ← in narrow overlay also pops back to the list — browser-back muscle
  // memory; skipped when typing into an input/textarea (note editor, search).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (paletteOpen) return; // cmdk handles its own Esc
        if (isNarrow && narrowDetailOpen) {
          setNarrowDetailOpen(false);
          return;
        }
        if (tab === "search") {
          const active = document.activeElement as HTMLElement | null;
          if (active?.tagName?.toLowerCase() === "input") return;
          const input = document.querySelector(
            ".search-bar__input",
          ) as HTMLInputElement | null;
          input?.focus();
        }
        return;
      }
      if (
        e.key === "ArrowLeft" &&
        isNarrow &&
        narrowDetailOpen &&
        !paletteOpen &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        setNarrowDetailOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNarrow, narrowDetailOpen, tab, paletteOpen]);

  // Drop the cached SearchResult when the selection changes to something we
  // didn't surface from SearchView — keeps ⌘D from acting on a stale item.
  useEffect(() => {
    if (!selectedKey || selectedItem?.id !== selectedKey) {
      if (selectedItem && selectedItem.id !== selectedKey) setSelectedItem(null);
    }
  }, [selectedKey, selectedItem]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      // ⌘K → toggle command palette. Works from anywhere, including inside
      // text inputs (matches Linear / Notion / Raycast behaviour).
      if (k === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      // Nav shortcuts work even while typing (Linear/Notion behaviour).
      // ⌘F → focus the search input, jumping to the Search tab if needed.
      if (k === "f") {
        e.preventDefault();
        setTab("search");
        setTimeout(() => {
          const input = document.querySelector(
            ".search-bar__input",
          ) as HTMLInputElement | null;
          input?.focus();
          input?.select();
        }, 0);
        return;
      }
      // ⌘, → Settings (mac standard).
      if (e.key === "," ) {
        e.preventDefault();
        setTab("settings");
        return;
      }
      // ⌘1-⌘4 tab switch — even while typing.
      if (e.key === "1") { e.preventDefault(); setTab("search"); return; }
      if (e.key === "2") { e.preventDefault(); setTab("favorites"); return; }
      if (e.key === "3") { e.preventDefault(); setTab("collections"); return; }
      if (e.key === "4") { e.preventDefault(); setTab("settings"); return; }

      // ⌘C → copy the selected row's primary citation. Only intercept when
      // the input has no text selection — otherwise the user is trying to
      // copy a substring of their query and we shouldn't steal that.
      if (k === "c" && !e.shiftKey && selectedKey) {
        const hasInputSelection =
          editing &&
          (target as HTMLInputElement | null)?.selectionStart !==
            (target as HTMLInputElement | null)?.selectionEnd;
        if (!hasInputSelection) {
          const el = document.querySelector(
            `[data-key="${cssEscape(selectedKey)}"] .code-row__code`,
          ) as HTMLElement | null;
          const text = el?.textContent?.trim();
          if (text) {
            e.preventDefault();
            void navigator.clipboard.writeText(text).then(() => {
              showToast(`Copied ${text}`);
            });
            return;
          }
        }
      }

      // ⌘D → toggle favorite. No native conflict, so this works even while
      // typing in the search box (matches Linear / Raycast behaviour).
      if (k === "d" && selectedKey) {
        e.preventDefault();
        if (isFavorite(selectedKey)) {
          removeFavorite(selectedKey);
          showToast("Removed from favorites");
          return;
        }
        if (selectedItem && selectedItem.id === selectedKey) {
          const wasFav = favorites.some((f) => f.compositeKey === selectedKey);
          toggleFavorite(selectedItem);
          showToast(wasFav ? "Removed from favorites" : "Added to favorites");
          return;
        }
        showToast("Open from search to favorite");
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey, selectedItem, favorites, isFavorite, toggleFavorite, removeFavorite]);

  return (
    <div className="app">
      <div className="app__main">
      <nav className="rail">
        <div className="rail__brand">IRS</div>
        <RailTab
          label="Search"
          icon="⌕"
          active={tab === "search"}
          onClick={() => setTab("search")}
        />
        <RailTab
          label="Favorites"
          icon="★"
          active={tab === "favorites"}
          onClick={() => setTab("favorites")}
        />
        <RailTab
          label="Collections"
          icon="🗂"
          active={tab === "collections"}
          onClick={() => setTab("collections")}
        />
        <div className="rail__spacer" />
        <RailTab
          label="Settings"
          icon="⚙"
          active={tab === "settings"}
          onClick={() => setTab("settings")}
        />
      </nav>

      <main
        className={`content${isNarrow ? " content--narrow" : ""}${
          isNarrow && narrowDetailOpen ? " content--detail-overlay" : ""
        }`}
      >
        {tab === "search" && (
          <SearchView
            selectedKey={selectedKey}
            onSelect={handleSelect}
            onQueryChange={setSearchQuery}
            onSelectItem={setSelectedItem}
          />
        )}
        {tab === "favorites" && (
          <FavoritesView
            selectedKey={selectedKey}
            onSelect={handleSelect}
          />
        )}
        {tab === "collections" && (
          <CollectionsView
            selectedKey={selectedKey}
            onSelect={handleSelect}
          />
        )}
        {tab === "settings" ? (
          <SettingsView />
        ) : (
          <>
            {!isNarrow && <Splitter />}
            <CodeDetailView
              compositeKey={selectedKey}
              onSelect={handleSelect}
              highlightQuery={tab === "search" ? searchQuery : ""}
              onClose={
                isNarrow ? () => setNarrowDetailOpen(false) : undefined
              }
            />
          </>
        )}
      </main>
      </div>

      <StatusBar />

      {premiumPrompt && (
        <PremiumPromptModal
          message={premiumPrompt}
          onClose={clearPremiumPrompt}
          onGoSettings={() => {
            clearPremiumPrompt();
            setTab("settings");
          }}
        />
      )}

      {!hasSeenOnboarding && (
        <OnboardingView onDismiss={dismissOnboarding} />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJumpToKey={(key) => {
          setTab("search");
          handleSelect(key);
        }}
        onJumpToTab={setTab}
      />

      <Toaster />
    </div>
  );
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/(["\\\]/])/g, "\\$1");
}

function RailTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rail__tab${active ? " rail__tab--active" : ""}`}
      onClick={onClick}
      title={label}
    >
      <span className="rail__icon">{icon}</span>
      <span className="rail__label">{label}</span>
    </button>
  );
}

export default App;
