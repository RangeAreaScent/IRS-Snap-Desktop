import { useEffect, useMemo, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { exportCollectionPDF } from "../export";
import { useAppData } from "../state";
import type { Collection, Favorite } from "../types";
import { useListKeyNav } from "../hooks/useListKeyNav";
import { BulkAddToCollectionModal } from "./BulkAddToCollectionModal";
import { showToast } from "./Toaster";

interface Props {
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
}

export function FavoritesView({ selectedKey, onSelect }: Props) {
  const { favorites, removeFavorite, bulkRemoveFavorites, notes } =
    useAppData();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [addOpen, setAddOpen] = useState(false);

  // Single-select navigation is suspended while Select mode is on — the
  // checkbox column owns the row, so ↑↓ shouldn't shift selection.
  const navItems = useMemo<{ id: string }[]>(
    () => (selecting ? [] : favorites.map((f) => ({ id: f.compositeKey }))),
    [selecting, favorites],
  );
  useListKeyNav(navItems, selectedKey, onSelect);

  // Auto-leave Select mode when the list empties (last bulk remove).
  useEffect(() => {
    if (favorites.length === 0 && selecting) {
      setSelecting(false);
      setPicked(new Set());
    }
  }, [favorites.length, selecting]);

  // Drop stale ids if a favorite is removed (e.g. via ⌘D) while picking.
  useEffect(() => {
    if (!selecting) return;
    setPicked((prev) => {
      const live = new Set(favorites.map((f) => f.compositeKey));
      const next = new Set<string>();
      prev.forEach((k) => live.has(k) && next.add(k));
      return next.size === prev.size ? prev : next;
    });
  }, [favorites, selecting]);

  function toggleRow(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function enterSelect() {
    setPicked(new Set());
    setSelecting(true);
  }

  function leaveSelect() {
    setSelecting(false);
    setPicked(new Set());
  }

  const pickedItems = useMemo(
    () => favorites.filter((f) => picked.has(f.compositeKey)),
    [favorites, picked],
  );

  async function bulkRemove() {
    if (pickedItems.length === 0) return;
    const ok = await ask(
      `Remove ${pickedItems.length} item${
        pickedItems.length === 1 ? "" : "s"
      } from Favorites?`,
      { title: "Remove favorites", kind: "warning" },
    );
    if (!ok) return;
    bulkRemoveFavorites(pickedItems.map((f) => f.compositeKey));
    showToast(`Removed ${pickedItems.length} from favorites`);
    leaveSelect();
  }

  async function bulkExport() {
    if (pickedItems.length === 0) return;
    const synthetic: Collection = {
      id: "__bulk__",
      name: `Favorites selection (${pickedItems.length})`,
      iconSymbol: "★",
      createdAt: Date.now(),
      items: pickedItems,
    };
    try {
      if (await exportCollectionPDF(synthetic, notes)) {
        showToast("PDF saved");
        leaveSelect();
      }
    } catch (e) {
      showToast(`Export failed: ${e}`);
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Favorites</h2>
        <span className="pane-header__count">{favorites.length}</span>
        {favorites.length > 0 && !selecting && (
          <button
            className="pane-header__action pane-header__action--text"
            onClick={enterSelect}
          >
            Select
          </button>
        )}
      </div>

      {selecting && (
        <div className="multi-bar">
          <span className="multi-bar__count">
            {pickedItems.length} selected
          </span>
          <span className="multi-bar__spacer" />
          <button
            className="icon-btn"
            disabled={pickedItems.length === 0}
            title="Add to collection"
            onClick={() => setAddOpen(true)}
          >
            📁
          </button>
          <button
            className="icon-btn"
            disabled={pickedItems.length === 0}
            title="Export as PDF"
            onClick={bulkExport}
          >
            📄
          </button>
          <button
            className="icon-btn icon-btn--danger"
            disabled={pickedItems.length === 0}
            title="Remove from favorites"
            onClick={bulkRemove}
          >
            🗑
          </button>
          <button
            className="icon-btn"
            title="Cancel"
            onClick={leaveSelect}
          >
            ✕
          </button>
        </div>
      )}

      <div className="list-scroll">
        {favorites.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No favorites yet</p>
            <p>Tap the ☆ on any search result to save it here.</p>
          </div>
        )}
        {favorites.map((fav) => (
          <FavoriteRow
            key={fav.compositeKey}
            fav={fav}
            selected={fav.compositeKey === selectedKey && !selecting}
            selecting={selecting}
            picked={picked.has(fav.compositeKey)}
            onSelect={() =>
              selecting ? toggleRow(fav.compositeKey) : onSelect(fav.compositeKey)
            }
            onRemove={() => removeFavorite(fav.compositeKey)}
          />
        ))}
      </div>

      {addOpen && (
        <BulkAddToCollectionModal
          items={pickedItems}
          onClose={() => setAddOpen(false)}
          onAdded={(_, count) => {
            showToast(`Added ${count} to collection`);
            leaveSelect();
          }}
        />
      )}
    </div>
  );
}

function FavoriteRow({
  fav,
  selected,
  selecting,
  picked,
  onSelect,
  onRemove,
}: {
  fav: Favorite;
  selected: boolean;
  selecting: boolean;
  picked: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const badge =
    fav.kind === "provision"
      ? { label: "IRC", cls: "irc" }
      : fav.kind === "form"
      ? { label: "Form", cls: "form" }
      : { label: "Pub", cls: "pub" };

  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}${
        selecting ? " code-row--selecting" : ""
      }${picked ? " code-row--picked" : ""}`}
      data-key={fav.compositeKey}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      {selecting && (
        <span
          className={`code-row__check${picked ? " code-row__check--on" : ""}`}
          aria-hidden="true"
        >
          {picked ? "✓" : ""}
        </span>
      )}
      <div className="code-row__main">
        <div className="code-row__top">
          <span className="code-row__code">{fav.primaryNumber}</span>
          <span className={`badge badge--${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="code-row__desc">{fav.headlineText}</div>
        {fav.secondaryText && (
          <div className="code-row__chapter">{fav.secondaryText}</div>
        )}
      </div>
      {!selecting && (
        <button
          className="star-btn star-btn--on"
          title="Remove from favorites"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ★
        </button>
      )}
    </div>
  );
}
