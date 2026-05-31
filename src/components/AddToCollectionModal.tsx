import { useState } from "react";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { CollectionFormModal } from "./CollectionFormModal";
import { Modal } from "./Modal";

interface Props {
  item: SearchResult;
  onClose: () => void;
}

export function AddToCollectionModal({ item, onClose }: Props) {
  const {
    collections,
    createCollection,
    addToCollection,
    removeFromCollection,
    isInCollection,
  } = useAppData();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CollectionFormModal
        title="New collection"
        submitLabel="Create"
        onClose={() => setCreating(false)}
        onSubmit={(name, iconSymbol) => {
          const id = createCollection(name, iconSymbol);
          if (id) addToCollection(id, item);
        }}
      />
    );
  }

  const title = `Add ${displayTitle(item)} to collection`;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <button
        className="btn btn--block"
        onClick={() => setCreating(true)}
      >
        ＋ New collection
      </button>
      {collections.length === 0 ? (
        <p className="modal-empty">No collections yet.</p>
      ) : (
        <div className="pick-list">
          {collections.map((c) => {
            const inside = isInCollection(c.id, item.id);
            return (
              <button
                key={c.id}
                className="pick-row"
                onClick={() =>
                  inside
                    ? removeFromCollection(c.id, item.id)
                    : addToCollection(c.id, item)
                }
              >
                <span className="pick-row__emoji">{c.iconSymbol}</span>
                <span className="pick-row__name">{c.name}</span>
                <span className="pick-row__count">{c.items.length}</span>
                <span className="pick-row__check">{inside ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function displayTitle(item: SearchResult): string {
  switch (item.kind) {
    case "provision":
      return item.data.shortCitation;
    case "form":
      return item.data.canonicalNumber;
    case "pub":
      return `Pub ${item.data.pubNumber}`;
  }
}
