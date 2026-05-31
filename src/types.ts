// IRS entity types — mirror the Rust wire types in src-tauri/src/irs.rs.

export type EntityKind = "provision" | "form" | "pub";

// ────── Summary (list-row) ──────

export interface ProvisionSummary {
  provisionId: string;        // "usc-26-199A" / "cfr-26-1.501(c)(3)-1"
  source: "usc" | "cfr";
  sectionNumber: string;
  heading: string;
  bodyExcerpt: string;
  shortCitation: string;
  popularName: string | null;
}

export interface FormSummary {
  canonicalNumber: string;
  category: "form" | "schedule" | "notice";
  parentForm: string | null;
  title: string;
  rawProductNumber: string;
}

export interface PubSummary {
  pubNumber: string;
  title: string;
  targetAudience: string | null;
}

// ────── Detail (full screen) ──────

export interface ProvisionDetail {
  provisionId: string;
  source: "usc" | "cfr";
  titleNumber: string;
  titleName: string;
  sectionNumber: string;
  subsection: string | null;
  heading: string;
  body: string;               // already decompressed by the Rust side
  citation: string;
  shortCitation: string;
  chapter: string | null;
  subchapter: string | null;
  part: string | null;
  popularName: string | null;
}

export interface FormDetail {
  canonicalNumber: string;
  category: "form" | "schedule" | "notice";
  title: string;
  parentForm: string | null;
  rawProductNumber: string;
  revisionDate: string | null;
  postedDate: string | null;
  pdfUrl: string;
  instructionsPdfUrl: string | null;
  relatedIrc: string[];
  relatedPubs: string[];
}

export interface PubDetail {
  pubNumber: string;
  title: string;
  rawProductNumber: string;
  revisionDate: string | null;
  postedDate: string | null;
  pdfUrl: string;
  targetAudience: string | null;
  relatedIrc: string[];
  relatedForms: string[];
}

// ────── Unified discriminated union (matches Rust SearchResult enum) ──────

export type SearchResult =
  | { kind: "provision"; id: string; data: ProvisionSummary }
  | { kind: "form";      id: string; data: FormSummary }
  | { kind: "pub";       id: string; data: PubSummary };

// ────── Persistence (favorites + collections + notes) ──────

/**
 * compositeKey-keyed favorite. compositeKey matches SearchResult.id —
 * "p:<provisionId>", "f:<canonical>", "f:<parent>/<canonical>", "u:<pubNumber>".
 */
export interface Favorite {
  compositeKey: string;
  kind: EntityKind;
  primaryNumber: string;       // "26 USC 199A", "1040", "Schedule C", "Pub 17"
  headlineText: string;
  secondaryText: string;
  parentForm: string | null;
  addedAt: number;
}

export interface CollectionItem extends Favorite {
  // Items inside a collection are the same shape as a Favorite, but live
  // under a parent Collection record.
}

export interface Collection {
  id: string;
  name: string;
  iconSymbol: string;          // SF Symbol-ish name; rendered to text/emoji on desktop
  createdAt: number;
  items: CollectionItem[];
}

export interface Note {
  text: string;
  editedAt: number;
}

/** Map of compositeKey → note. */
export type NoteMap = Record<string, Note>;
