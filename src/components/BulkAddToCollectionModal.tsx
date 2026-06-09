import { useState } from "react";
import { useAppData } from "../state";
import type { Favorite } from "../types";
import { CollectionFormModal } from "./CollectionFormModal";
import { Modal } from "./Modal";

interface Props {
  items: Favorite[];
  onClose: () => void;
  /** Called after each successful add — lets the caller exit Select mode. */
  onAdded?: (collectionId: string, count: number) => void;
}

export function BulkAddToCollectionModal({ items, onClose, onAdded }: Props) {
  const { collections, createCollection, addFavoritesToCollection } =
    useAppData();
  const [creating, setCreating] = useState(false);

  function addTo(id: string) {
    addFavoritesToCollection(id, items);
    onAdded?.(id, items.length);
    onClose();
  }

  if (creating) {
    return (
      <CollectionFormModal
        title="New collection"
        submitLabel="Create &amp; add"
        onClose={() => setCreating(false)}
        onSubmit={(name, iconSymbol) => {
          const id = createCollection(name, iconSymbol);
          if (id) {
            addFavoritesToCollection(id, items);
            onAdded?.(id, items.length);
          }
          onClose();
        }}
      />
    );
  }

  const noun = items.length === 1 ? "item" : "items";
  return (
    <Modal
      title={`Add ${items.length} ${noun} to collection`}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <button className="btn btn--block" onClick={() => setCreating(true)}>
        ＋ New collection
      </button>
      {collections.length === 0 ? (
        <p className="modal-empty">No collections yet.</p>
      ) : (
        <div className="pick-list">
          {collections.map((c) => {
            const existing = new Set(c.items.map((i) => i.compositeKey));
            const fresh = items.filter(
              (i) => !existing.has(i.compositeKey),
            ).length;
            return (
              <button
                key={c.id}
                className="pick-row"
                onClick={() => addTo(c.id)}
              >
                <span className="pick-row__emoji">{c.iconSymbol}</span>
                <span className="pick-row__name">{c.name}</span>
                <span className="pick-row__count">
                  {c.items.length}
                  {fresh < items.length && (
                    <em className="pick-row__dim">
                      {" "}+{fresh} new
                    </em>
                  )}
                </span>
                <span className="pick-row__check">›</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
