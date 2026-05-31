import { useEffect, useRef, useState } from "react";
import { exportCollectionCSV, exportCollectionPDF } from "../export";
import { useAppData } from "../state";
import type { Collection, CollectionItem } from "../types";
import { AddCodeModal } from "./AddCodeModal";
import { CollectionFormModal } from "./CollectionFormModal";

interface Props {
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
}

export function CollectionsView({ selectedKey, onSelect }: Props) {
  const { collections } = useAppData();
  const [openId, setOpenId] = useState<string | null>(null);

  const open = collections.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  if (open) {
    return (
      <CollectionDetail
        collection={open}
        selectedKey={selectedKey}
        onSelect={onSelect}
        onBack={() => setOpenId(null)}
      />
    );
  }
  return <CollectionList onOpen={setOpenId} />;
}

function CollectionList({ onOpen }: { onOpen: (id: string) => void }) {
  const { collections, createCollection, collectionsMax, promptPremium } =
    useAppData();
  const [creating, setCreating] = useState(false);

  const atLimit = collections.length >= collectionsMax;
  function startNew() {
    if (atLimit) {
      promptPremium(
        "The free plan keeps up to 10 collections. " +
          "Unlock unlimited collections with premium.",
      );
    } else {
      setCreating(true);
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Collections</h2>
        <span className="pane-header__count">{collections.length}</span>
        <button
          className="pane-header__action"
          title="New collection"
          onClick={startNew}
        >
          ＋
        </button>
      </div>
      <div className="list-scroll">
        {collections.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No collections yet</p>
            <p>Group related items — e.g. "Schedule C clients", "401(k) planning".</p>
          </div>
        )}
        {collections.map((c) => (
          <button
            key={c.id}
            className="collection-row"
            onClick={() => onOpen(c.id)}
          >
            <span className="collection-row__emoji">{c.iconSymbol}</span>
            <span className="collection-row__main">
              <span className="collection-row__name">{c.name}</span>
              <span className="collection-row__count">
                {c.items.length} item{c.items.length === 1 ? "" : "s"}
              </span>
            </span>
            <span className="collection-row__chevron">›</span>
          </button>
        ))}
      </div>

      {creating && (
        <CollectionFormModal
          title="New collection"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={(name, iconSymbol) => createCollection(name, iconSymbol)}
        />
      )}
    </div>
  );
}

interface DetailProps {
  collection: Collection;
  selectedKey: string | null;
  onSelect: (compositeKey: string) => void;
  onBack: () => void;
}

function CollectionDetail({
  collection,
  selectedKey,
  onSelect,
  onBack,
}: DetailProps) {
  const { notes, renameCollection, deleteCollection, removeFromCollection } =
    useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"rename" | "addcode" | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function flash(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg((m) => (m === msg ? null : m)), 2000);
  }

  async function copyAll() {
    setMenuOpen(false);
    if (collection.items.length === 0) return;
    await navigator.clipboard.writeText(
      collection.items.map((i) => i.primaryNumber).join(", "),
    );
    flash("Numbers copied");
  }

  async function exportCSV() {
    setMenuOpen(false);
    try {
      if (await exportCollectionCSV(collection, notes)) flash("CSV saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  async function exportPDF() {
    setMenuOpen(false);
    if (collection.items.length === 0) return;
    try {
      if (await exportCollectionPDF(collection, notes)) flash("PDF saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  function confirmDelete() {
    setMenuOpen(false);
    if (window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) {
      deleteCollection(collection.id);
      onBack();
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header pane-header--detail">
        <button className="back-btn" onClick={onBack} title="Back">
          ‹
        </button>
        <div className="collection-head">
          <span className="collection-head__emoji">{collection.iconSymbol}</span>
          <div>
            <div className="collection-head__name">{collection.name}</div>
            <div className="collection-head__count">
              {collection.items.length} item
              {collection.items.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="menu-wrap" ref={menuRef}>
          <button
            className="pane-header__action"
            title="Actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu">
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("addcode");
                }}
              >
                Add item
              </button>
              <button className="menu__item" onClick={copyAll}>
                Copy all numbers
              </button>
              <button className="menu__item" onClick={exportCSV}>
                Export as CSV…
              </button>
              <button className="menu__item" onClick={exportPDF}>
                Export as PDF…
              </button>
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("rename");
                }}
              >
                Rename
              </button>
              <button
                className="menu__item menu__item--danger"
                onClick={confirmDelete}
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="list-scroll">
        {collection.items.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">Empty collection</p>
            <p>Use the ⋯ menu to add items.</p>
          </div>
        )}
        {collection.items.map((item) => (
          <CollectionItemRow
            key={item.compositeKey}
            item={item}
            selected={item.compositeKey === selectedKey}
            onSelect={() => onSelect(item.compositeKey)}
            onRemove={() =>
              removeFromCollection(collection.id, item.compositeKey)
            }
          />
        ))}
      </div>

      {statusMsg && <div className="inline-status">{statusMsg}</div>}

      {modal === "rename" && (
        <CollectionFormModal
          title="Rename collection"
          submitLabel="Save"
          initialName={collection.name}
          initialEmoji={collection.iconSymbol}
          onClose={() => setModal(null)}
          onSubmit={(name, iconSymbol) =>
            renameCollection(collection.id, name, iconSymbol)
          }
        />
      )}
      {modal === "addcode" && (
        <AddCodeModal
          collectionId={collection.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CollectionItemRow({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: CollectionItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const badge =
    item.kind === "provision"
      ? { label: "IRC", cls: "irc" }
      : item.kind === "form"
      ? { label: "Form", cls: "form" }
      : { label: "Pub", cls: "pub" };

  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="code-row__main">
        <div className="code-row__top">
          <span className="code-row__code">{item.primaryNumber}</span>
          <span className={`badge badge--${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="code-row__desc">{item.headlineText}</div>
        {item.secondaryText && (
          <div className="code-row__chapter">{item.secondaryText}</div>
        )}
      </div>
      <button
        className="star-btn"
        title="Remove from collection"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ✕
      </button>
    </div>
  );
}
