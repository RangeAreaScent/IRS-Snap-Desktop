import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Collection, NoteMap } from "./types";

/**
 * Wire shape consumed by Rust `pdf::ExportEntry`. The Rust struct keeps the
 * original ICD field names (code/description/billable/chapter/block/category)
 * for binary compatibility; we map IRS fields onto them at the JS edge so the
 * PDF rendering pipeline stays untouched:
 *
 *   code         ← primaryNumber       ("26 USC 199A", "1040", "Pub 17")
 *   description  ← headlineText
 *   note         ← user note
 *   billable     ← Kind label          ("IRC" | "Form" | "Pub")
 *   chapter      ← secondaryText       (popular name / parent form / audience)
 *   block        ← parentForm or ""    (schedules only)
 *   category     ← source              ("uscode.house.gov", "irs.gov" …)
 */
interface ExportEntry {
  code: string;
  description: string;
  note: string;
  billable: string;
  chapter: string;
  block: string;
  category: string;
}

function kindLabel(kind: string): string {
  if (kind === "provision") return "IRC";
  if (kind === "form") return "Form";
  if (kind === "pub") return "Pub";
  return kind;
}

function sourceFor(kind: string, compositeKey: string): string {
  if (kind === "provision") {
    if (compositeKey.startsWith("p:usc-")) return "uscode.house.gov";
    if (compositeKey.startsWith("p:cfr-")) return "ecfr.gov";
  }
  return "irs.gov";
}

function buildEntries(c: Collection, notes: NoteMap): ExportEntry[] {
  return c.items.map((item) => ({
    code: item.primaryNumber,
    description: item.headlineText,
    note: notes[item.compositeKey]?.text ?? "",
    billable: kindLabel(item.kind),
    chapter: item.secondaryText,
    block: item.parentForm ?? "",
    category: sourceFor(item.kind, item.compositeKey),
  }));
}

// ────── CSV ──────

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADER = [
  "Number",
  "Title",
  "Note",
  "Kind",
  "Detail",
  "Parent",
  "Source",
];

export async function exportCollectionCSV(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;

  const entries = buildEntries(c, notes);
  const rows = [
    CSV_HEADER,
    ...entries.map((e) => [
      e.code,
      e.description,
      e.note,
      e.billable,
      e.chapter,
      e.block,
      e.category,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  await invoke("write_text_file", { path, content: csv });
  return true;
}

// ────── PDF (rendered by Rust) ──────

export async function exportCollectionPDF(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return false;

  const entries = buildEntries(c, notes);
  await invoke("export_pdf", { path, title: c.name, entries });
  return true;
}
