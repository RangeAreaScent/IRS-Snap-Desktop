import { useEffect, useState } from "react";
import "./styles.css";
import { CodeDetailView } from "./components/CodeDetailView";
import { CollectionsView } from "./components/CollectionsView";
import { FavoritesView } from "./components/FavoritesView";
import { OnboardingView } from "./components/OnboardingView";
import { PremiumPromptModal } from "./components/PremiumPromptModal";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { AppDataProvider, useAppData } from "./state";
import { SettingsProvider, useSettings } from "./settings";

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
  const [searchQuery, setSearchQuery] = useState("");
  const { premiumPrompt, clearPremiumPrompt } = useAppData();
  const { hasSeenOnboarding, dismissOnboarding } = useSettings();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      // ⌘F focus search tab
      if (k === "f") {
        e.preventDefault();
        setTab("search");
        return;
      }
      // ⌘1-⌘4 tab switch — only when not typing in an input
      const target = e.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (editing) return;
      switch (e.key) {
        case "1": e.preventDefault(); setTab("search"); break;
        case "2": e.preventDefault(); setTab("favorites"); break;
        case "3": e.preventDefault(); setTab("collections"); break;
        case "4": e.preventDefault(); setTab("settings"); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
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

      <main className="content">
        {tab === "search" && (
          <SearchView
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onQueryChange={setSearchQuery}
          />
        )}
        {tab === "favorites" && (
          <FavoritesView
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        )}
        {tab === "collections" && (
          <CollectionsView
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        )}
        {tab === "settings" ? (
          <SettingsView />
        ) : (
          <CodeDetailView
            compositeKey={selectedKey}
            onSelect={setSelectedKey}
            highlightQuery={tab === "search" ? searchQuery : ""}
          />
        )}
      </main>

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
    </div>
  );
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
