import { useEffect, useState } from "react";
import { fetchForm, fetchProvision, fetchPublication } from "../api";
import { highlight } from "../highlight";
import { RecentStore } from "../recents";
import { useAppData } from "../state";
import type {
  FormDetail,
  ProvisionDetail,
  PubDetail,
  SearchResult,
} from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { NoteSection } from "./NoteSection";

interface Props {
  compositeKey: string | null;
  onSelect: (compositeKey: string) => void;
  /** Active search query — body matches are highlighted when non-empty. */
  highlightQuery?: string;
  /** When set, render a back button (narrow window overlay mode). */
  onClose?: () => void;
}

type Loaded =
  | { kind: "provision"; data: ProvisionDetail }
  | { kind: "form";      data: FormDetail }
  | { kind: "pub";       data: PubDetail };

export function CodeDetailView({ compositeKey, onSelect, highlightQuery = "", onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { isFavorite, toggleFavorite, notes } = useAppData();

  useEffect(() => {
    if (!compositeKey) {
      setLoaded(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    loadByKey(compositeKey)
      .then((d) => {
        if (!active) return;
        setLoaded(d);
        if (!d) {
          setError(`Not found: ${compositeKey}`);
        } else {
          RecentStore.add(toRecentItem(d, compositeKey));
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [compositeKey]);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch (e) {
      console.error("copy failed:", e);
    }
  }

  if (!compositeKey) {
    return <EmptyDetail />;
  }
  if (loading) {
    return (
      <div className="detail-pane detail-pane--empty">
        {onClose && (
          <button className="detail-back" onClick={onClose}>‹ Back</button>
        )}
        <p>Loading…</p>
      </div>
    );
  }
  if (error || !loaded) {
    return (
      <div className="detail-pane detail-pane--empty">
        {onClose && (
          <button className="detail-back" onClick={onClose}>‹ Back</button>
        )}
        <p>{error ?? "Not found."}</p>
      </div>
    );
  }

  const note = notes[compositeKey];
  const noteSuffix = note?.text ? `\n\nNote: ${note.text}` : "";

  const view = (() => {
    if (loaded.kind === "provision") {
      const d = loaded.data;
      const asItem: SearchResult = {
        kind: "provision",
        id: compositeKey,
        data: {
          provisionId: d.provisionId,
          source: d.source,
          sectionNumber: d.sectionNumber,
          heading: d.heading,
          bodyExcerpt: "",
          shortCitation: d.shortCitation,
          popularName: d.popularName,
        },
      };
      const fullText =
        `${d.shortCitation} — ${d.heading}\n` +
        (d.popularName ? `Popular name: ${d.popularName}\n` : "") +
        `\n${d.body}\n` +
        `\nCitation: ${d.citation}${noteSuffix}`;

      return (
        <ProvisionLayout
          d={d}
          fullText={fullText}
          copied={copied}
          copy={copy}
          fav={isFavorite(compositeKey)}
          onToggleFavorite={() => toggleFavorite(asItem)}
          onAddToCollection={() => setAdding(true)}
          asItem={asItem}
          highlightQuery={highlightQuery}
          compositeKey={compositeKey}
        />
      );
    }
    if (loaded.kind === "form") {
      const d = loaded.data;
      const asItem: SearchResult = {
        kind: "form",
        id: compositeKey,
        data: {
          canonicalNumber: d.canonicalNumber,
          category: d.category,
          parentForm: d.parentForm,
          title: d.title,
          rawProductNumber: d.rawProductNumber,
        },
      };
      const fullText =
        `${d.rawProductNumber}: ${d.title}\n` +
        (d.relatedIrc.length ? `Related IRC: ${d.relatedIrc.join(", ")}\n` : "") +
        (d.relatedPubs.length ? `Related Pubs: ${d.relatedPubs.join(", ")}\n` : "") +
        `PDF: ${d.pdfUrl}\n` +
        (d.instructionsPdfUrl ? `Instructions: ${d.instructionsPdfUrl}\n` : "") +
        noteSuffix;

      return (
        <FormLayout
          d={d}
          fullText={fullText}
          copied={copied}
          copy={copy}
          fav={isFavorite(compositeKey)}
          onToggleFavorite={() => toggleFavorite(asItem)}
          onAddToCollection={() => setAdding(true)}
          onChipSelect={onSelect}
          asItem={asItem}
          highlightQuery={highlightQuery}
          compositeKey={compositeKey}
        />
      );
    }
    // pub
    const d = loaded.data;
    const asItem: SearchResult = {
      kind: "pub",
      id: compositeKey,
      data: {
        pubNumber: d.pubNumber,
        title: d.title,
        targetAudience: d.targetAudience,
      },
    };
    const fullText =
      `${d.rawProductNumber}: ${d.title}\n` +
      (d.targetAudience ? `For: ${d.targetAudience}\n` : "") +
      (d.relatedIrc.length ? `Related IRC: ${d.relatedIrc.join(", ")}\n` : "") +
      (d.relatedForms.length ? `Related forms: ${d.relatedForms.join(", ")}\n` : "") +
      `PDF: ${d.pdfUrl}` +
      noteSuffix;

    return (
      <PubLayout
        d={d}
        fullText={fullText}
        copied={copied}
        copy={copy}
        fav={isFavorite(compositeKey)}
        onToggleFavorite={() => toggleFavorite(asItem)}
        onAddToCollection={() => setAdding(true)}
        onChipSelect={onSelect}
        asItem={asItem}
        highlightQuery={highlightQuery}
        compositeKey={compositeKey}
      />
    );
  })();

  return (
    <>
      {onClose && (
        <button
          className="detail-back detail-back--floating"
          onClick={onClose}
        >
          ‹ Back
        </button>
      )}
      {view}
      {adding && loaded && (
        <AddToCollectionModal
          item={getAsItem(loaded, compositeKey)}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

// ───────────────────────── Empty state with shortcut guide ─────────────────────────

function EmptyDetail() {
  const mod = isMac() ? "⌘" : "Ctrl";
  return (
    <div className="detail-pane detail-pane--empty">
      <div className="detail-empty">
        <div className="detail-empty__title">Select an item</div>
        <div className="detail-empty__hint">
          Pick a result on the left, or use the keyboard.
        </div>
        <dl className="detail-empty__keys">
          <dt><kbd>↑</kbd><kbd>↓</kbd></dt>
          <dd>Move between rows</dd>
          <dt><kbd>{mod}</kbd><kbd>F</kbd></dt>
          <dd>Focus the search box</dd>
          <dt><kbd>{mod}</kbd><kbd>K</kbd></dt>
          <dd>Open the command palette</dd>
          <dt><kbd>{mod}</kbd><kbd>C</kbd></dt>
          <dd>Copy the selected citation</dd>
          <dt><kbd>{mod}</kbd><kbd>D</kbd></dt>
          <dd>Toggle favorite</dd>
          <dt><kbd>{mod}</kbd><kbd>E</kbd></dt>
          <dd>Export the open collection</dd>
          <dt><kbd>{mod}</kbd><kbd>1</kbd>…<kbd>4</kbd></dt>
          <dd>Jump to a tab</dd>
          <dt><kbd>{mod}</kbd><kbd>,</kbd></dt>
          <dd>Open Settings</dd>
          <dt><kbd>Esc</kbd></dt>
          <dd>Back to the list / search</dd>
          <dt><kbd>←</kbd></dt>
          <dd>Back to the list (narrow window)</dd>
        </dl>
      </div>
    </div>
  );
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const plat = (navigator.platform || "") + " " + (navigator.userAgent || "");
  return /Mac|iPhone|iPad/.test(plat);
}

// ───────────────────────── Layouts ─────────────────────────

function ProvisionLayout(props: {
  d: ProvisionDetail;
  fullText: string;
  copied: string | null;
  copy: (label: string, text: string) => void;
  fav: boolean;
  onToggleFavorite: () => void;
  onAddToCollection: () => void;
  asItem: SearchResult;
  highlightQuery: string;
  compositeKey: string;
}) {
  const { d, fullText, copied, copy, fav, onToggleFavorite, onAddToCollection, highlightQuery, compositeKey } =
    props;
  return (
    <div className="detail-pane">
      <DetailToolbar
        fav={fav}
        onToggleFavorite={onToggleFavorite}
        onAddToCollection={onAddToCollection}
      />
      <div className="detail-hero">
        <div className="detail-hero__code">{highlight(d.shortCitation, highlightQuery)}</div>
        <div className="detail-hero__desc">{highlight(d.heading, highlightQuery)}</div>
        {d.popularName && (
          <span className="badge badge--popular">{d.popularName}</span>
        )}
      </div>
      <CopyButtons
        primary={["Copy Citation  " + d.shortCitation, d.citation]}
        secondary={["Copy Citation + Heading", `${d.shortCitation} — ${d.heading}`]}
        tertiary={["Copy Full Text", fullText]}
        copied={copied}
        copy={copy}
      />
      <div className="detail-section">
        <div className="detail-section__label">Citation</div>
        <div className="detail-citation">{d.citation}</div>
      </div>
      <div className="detail-section">
        <div className="detail-section__label">Body</div>
        <div className="detail-body">{highlight(d.body, highlightQuery)}</div>
      </div>
      <NoteSection compositeKey={compositeKey} displayHeader={`${d.shortCitation} — ${d.heading}`} />
    </div>
  );
}

function FormLayout(props: {
  d: FormDetail;
  fullText: string;
  copied: string | null;
  copy: (label: string, text: string) => void;
  fav: boolean;
  onToggleFavorite: () => void;
  onAddToCollection: () => void;
  onChipSelect: (compositeKey: string) => void;
  asItem: SearchResult;
  highlightQuery: string;
  compositeKey: string;
}) {
  const { d, fullText, copied, copy, fav, onToggleFavorite, onAddToCollection, onChipSelect, highlightQuery, compositeKey } =
    props;
  const display = d.parentForm
    ? `${d.canonicalNumber} (${d.parentForm})`
    : d.canonicalNumber;
  return (
    <div className="detail-pane">
      <DetailToolbar
        fav={fav}
        onToggleFavorite={onToggleFavorite}
        onAddToCollection={onAddToCollection}
      />
      <div className="detail-hero">
        <div className="detail-hero__code">{highlight(display, highlightQuery)}</div>
        <div className="detail-hero__desc">{highlight(d.title, highlightQuery)}</div>
        <span className={`badge badge--${d.category}`}>
          {d.category === "form" ? "Form" : d.category === "schedule" ? "Schedule" : "Notice"}
        </span>
      </div>
      <CopyButtons
        primary={[`Copy  ${d.rawProductNumber}`, d.rawProductNumber]}
        secondary={["Copy Number + Title", `${d.rawProductNumber}: ${d.title}`]}
        tertiary={["Copy Full Detail", fullText]}
        copied={copied}
        copy={copy}
      />
      <div className="detail-actions">
        <a href={d.pdfUrl} target="_blank" rel="noreferrer" className="action-link action-link--primary">
          Open PDF
        </a>
        {d.instructionsPdfUrl && (
          <a href={d.instructionsPdfUrl} target="_blank" rel="noreferrer" className="action-link">
            Instructions
          </a>
        )}
      </div>
      {(d.revisionDate || d.postedDate) && (
        <div className="detail-meta">
          {d.revisionDate && <span>Rev. {d.revisionDate}</span>}
          {d.postedDate && <span>Posted {d.postedDate}</span>}
        </div>
      )}
      {d.relatedIrc.length > 0 && (
        <ChipSection
          title="Related IRC sections"
          chips={d.relatedIrc.map((id) => ({
            label: provisionChipLabel(id),
            compositeKey: `p:${id}`,
          }))}
          onChipSelect={onChipSelect}
        />
      )}
      {d.relatedPubs.length > 0 && (
        <ChipSection
          title="Related publications"
          chips={d.relatedPubs.map((n) => ({
            label: `Pub ${n}`,
            compositeKey: `u:${n}`,
          }))}
          onChipSelect={onChipSelect}
        />
      )}
      <NoteSection compositeKey={compositeKey} displayHeader={`${d.rawProductNumber} — ${d.title}`} />
    </div>
  );
}

function PubLayout(props: {
  d: PubDetail;
  fullText: string;
  copied: string | null;
  copy: (label: string, text: string) => void;
  fav: boolean;
  onToggleFavorite: () => void;
  onAddToCollection: () => void;
  onChipSelect: (compositeKey: string) => void;
  asItem: SearchResult;
  highlightQuery: string;
  compositeKey: string;
}) {
  const { d, fullText, copied, copy, fav, onToggleFavorite, onAddToCollection, onChipSelect, highlightQuery, compositeKey } =
    props;
  return (
    <div className="detail-pane">
      <DetailToolbar
        fav={fav}
        onToggleFavorite={onToggleFavorite}
        onAddToCollection={onAddToCollection}
      />
      <div className="detail-hero">
        <div className="detail-hero__code">{highlight(`Pub ${d.pubNumber}`, highlightQuery)}</div>
        <div className="detail-hero__desc">{highlight(d.title, highlightQuery)}</div>
        {d.targetAudience && (
          <span className="badge badge--audience">{d.targetAudience}</span>
        )}
      </div>
      <CopyButtons
        primary={[`Copy  ${d.rawProductNumber}`, d.rawProductNumber]}
        secondary={["Copy Number + Title", `${d.rawProductNumber}: ${d.title}`]}
        tertiary={["Copy Full Detail", fullText]}
        copied={copied}
        copy={copy}
      />
      <div className="detail-actions">
        <a href={d.pdfUrl} target="_blank" rel="noreferrer" className="action-link action-link--primary">
          Open PDF
        </a>
      </div>
      {d.relatedIrc.length > 0 && (
        <ChipSection
          title="Related IRC sections"
          chips={d.relatedIrc.map((id) => ({
            label: provisionChipLabel(id),
            compositeKey: `p:${id}`,
          }))}
          onChipSelect={onChipSelect}
        />
      )}
      {d.relatedForms.length > 0 && (
        <ChipSection
          title="Related forms"
          chips={d.relatedForms.map((c) => ({
            label: c,
            compositeKey: `f:${c}`,
          }))}
          onChipSelect={onChipSelect}
        />
      )}
      <NoteSection compositeKey={compositeKey} displayHeader={`${d.rawProductNumber} — ${d.title}`} />
    </div>
  );
}

// ───────────────────────── shared bits ─────────────────────────

function DetailToolbar({
  fav,
  onToggleFavorite,
  onAddToCollection,
}: {
  fav: boolean;
  onToggleFavorite: () => void;
  onAddToCollection: () => void;
}) {
  return (
    <div className="detail-toolbar">
      <button className="detail-toolbar__btn" onClick={onAddToCollection} title="Add to collection">
        📁⁺
      </button>
      <button
        className={`detail-toolbar__btn${fav ? " star-btn--on" : ""}`}
        onClick={onToggleFavorite}
        title={fav ? "Remove from favorites" : "Add to favorites"}
      >
        {fav ? "★" : "☆"}
      </button>
    </div>
  );
}

function CopyButtons({
  primary,
  secondary,
  tertiary,
  copied,
  copy,
}: {
  primary: [string, string];
  secondary: [string, string];
  tertiary: [string, string];
  copied: string | null;
  copy: (label: string, text: string) => void;
}) {
  // .copy-group is the ICD-Snap convention — vertical stack, max-width 340px,
  // first child is the prominent accent button (via :first-child rule in
  // styles.css).
  return (
    <div className="copy-group">
      <button className="copy-btn" onClick={() => copy(primary[0], primary[1])}>
        {copied === primary[0] ? "✓ Copied" : primary[0]}
      </button>
      <button className="copy-btn" onClick={() => copy(secondary[0], secondary[1])}>
        {copied === secondary[0] ? "✓ Copied" : secondary[0]}
      </button>
      <button className="copy-btn" onClick={() => copy(tertiary[0], tertiary[1])}>
        {copied === tertiary[0] ? "✓ Copied" : tertiary[0]}
      </button>
    </div>
  );
}

function ChipSection({
  title,
  chips,
  onChipSelect,
}: {
  title: string;
  chips: Array<{ label: string; compositeKey: string }>;
  onChipSelect: (compositeKey: string) => void;
}) {
  return (
    <div className="detail-section">
      <div className="detail-section__label">{title}</div>
      <div className="chip-row">
        {chips.map((c) => (
          <button
            key={c.compositeKey}
            className="chip"
            onClick={() => onChipSelect(c.compositeKey)}
            title={c.compositeKey}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── helpers ─────────────────────────

function provisionChipLabel(id: string): string {
  // "usc-26-162" → "§ 162", "cfr-26-1.501(c)(3)-1" → "§ 1.501(c)(3)-1"
  const parts = id.split("-");
  if (parts.length >= 3) {
    return "§ " + parts.slice(2).join("-");
  }
  return id;
}

async function loadByKey(key: string): Promise<Loaded | null> {
  const parts = key.split(":");
  if (parts.length < 2) return null;
  const [prefix, ...rest] = parts;
  const value = rest.join(":");
  if (prefix === "p") {
    const d = await fetchProvision(value);
    return d ? { kind: "provision", data: d } : null;
  }
  if (prefix === "f") {
    const slashIdx = value.indexOf("/");
    if (slashIdx >= 0) {
      const parent = value.slice(0, slashIdx);
      const canonical = value.slice(slashIdx + 1);
      const d = await fetchForm(canonical, parent);
      return d ? { kind: "form", data: d } : null;
    }
    const d = await fetchForm(value, null);
    return d ? { kind: "form", data: d } : null;
  }
  if (prefix === "u") {
    const d = await fetchPublication(value);
    return d ? { kind: "pub", data: d } : null;
  }
  return null;
}

function toRecentItem(loaded: Loaded, compositeKey: string) {
  if (loaded.kind === "provision") {
    const d = loaded.data;
    return {
      id: compositeKey,
      kind: "provision",
      primaryNumber: d.shortCitation,
      headlineText: d.heading,
      secondaryText: d.popularName ?? "",
      parentForm: null,
    };
  }
  if (loaded.kind === "form") {
    const d = loaded.data;
    return {
      id: compositeKey,
      kind: "form",
      primaryNumber: d.canonicalNumber,
      headlineText: d.title,
      secondaryText: d.parentForm ?? d.category,
      parentForm: d.parentForm,
    };
  }
  const d = loaded.data;
  return {
    id: compositeKey,
    kind: "pub",
    primaryNumber: `Pub ${d.pubNumber}`,
    headlineText: d.title,
    secondaryText: d.targetAudience ?? "",
    parentForm: null,
  };
}

function getAsItem(loaded: Loaded, key: string): SearchResult {
  if (loaded.kind === "provision") {
    const d = loaded.data;
    return {
      kind: "provision",
      id: key,
      data: {
        provisionId: d.provisionId,
        source: d.source,
        sectionNumber: d.sectionNumber,
        heading: d.heading,
        bodyExcerpt: "",
        shortCitation: d.shortCitation,
        popularName: d.popularName,
      },
    };
  }
  if (loaded.kind === "form") {
    const d = loaded.data;
    return {
      kind: "form",
      id: key,
      data: {
        canonicalNumber: d.canonicalNumber,
        category: d.category,
        parentForm: d.parentForm,
        title: d.title,
        rawProductNumber: d.rawProductNumber,
      },
    };
  }
  const d = loaded.data;
  return {
    kind: "pub",
    id: key,
    data: {
      pubNumber: d.pubNumber,
      title: d.title,
      targetAudience: d.targetAudience,
    },
  };
}
