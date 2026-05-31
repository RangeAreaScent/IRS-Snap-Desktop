//! Read-only access to the bundled irssnap.sqlite (~31 MB).
//!
//! Schema (built by IRS-Snap/data_pipeline/scripts/build_sqlite.py):
//!   - provisions          (IRC 26 USC + 26 CFR), FTS5: provisions_fts
//!   - irs_forms           (forms / schedules / notices), FTS5: irs_forms_fts
//!   - irs_publications    (Pubs), FTS5: irs_publications_fts
//!   - irs_index_variants  (multilingual side table, not surfaced in v1)
//!
//! Search strategy mirrors iOS IRSRepository:
//!   1. Per-entity prefix matches (deterministic identifier lookups)
//!   2. Per-entity FTS5 ranked matches
//!   3. Interleave: all prefix matches FIRST across entities (so a "schedule c"
//!      query lifts the Schedule C form above broad IRC FTS hits),
//!      then FTS hits.

use rusqlite::{params, Connection, OpenFlags, Row};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

// ────────────────────────────────────────────────────────────────────────────
// Wire types — camelCased for the JS side
// ────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionSummary {
    pub provision_id: String,    // "usc-26-199A" / "cfr-26-1.501(c)(3)-1"
    pub source: String,          // "usc" | "cfr"
    pub section_number: String,
    pub heading: String,
    pub body_excerpt: String,
    pub short_citation: String,
    pub popular_name: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FormSummary {
    pub canonical_number: String,
    pub category: String,        // "form" | "schedule" | "notice"
    pub parent_form: Option<String>,
    pub title: String,
    pub raw_product_number: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PubSummary {
    pub pub_number: String,
    pub title: String,
    pub target_audience: Option<String>,
}

/// Unified search-list row: discriminated union for the JS side.
#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SearchResult {
    #[serde(rename = "provision")]
    Provision { id: String, data: ProvisionSummary },
    #[serde(rename = "form")]
    Form { id: String, data: FormSummary },
    #[serde(rename = "pub")]
    Publication { id: String, data: PubSummary },
}

impl SearchResult {
    fn id(&self) -> &str {
        match self {
            SearchResult::Provision { id, .. } => id,
            SearchResult::Form { id, .. } => id,
            SearchResult::Publication { id, .. } => id,
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Detail wire types
// ────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionDetail {
    pub provision_id: String,
    pub source: String,
    pub title_number: String,
    pub title_name: String,
    pub section_number: String,
    pub subsection: Option<String>,
    pub heading: String,
    pub body: String,             // decompressed (raw DEFLATE → utf-8)
    pub citation: String,
    pub short_citation: String,
    pub chapter: Option<String>,
    pub subchapter: Option<String>,
    pub part: Option<String>,
    pub popular_name: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FormDetail {
    pub canonical_number: String,
    pub category: String,
    pub title: String,
    pub parent_form: Option<String>,
    pub raw_product_number: String,
    pub revision_date: Option<String>,
    pub posted_date: Option<String>,
    pub pdf_url: String,
    pub instructions_pdf_url: Option<String>,
    pub related_irc: Vec<String>,
    pub related_pubs: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PubDetail {
    pub pub_number: String,
    pub title: String,
    pub raw_product_number: String,
    pub revision_date: Option<String>,
    pub posted_date: Option<String>,
    pub pdf_url: String,
    pub target_audience: Option<String>,
    pub related_irc: Vec<String>,
    pub related_forms: Vec<String>,
}

// ────────────────────────────────────────────────────────────────────────────
// Connection
// ────────────────────────────────────────────────────────────────────────────

fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("failed to open IRS database: {e}"))
}

// ────────────────────────────────────────────────────────────────────────────
// Search — unified
// ────────────────────────────────────────────────────────────────────────────

pub fn search(db_path: &Path, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let conn = open(db_path)?;
    let fts_query = make_fts_query(trimmed);

    let prov_prefix = normalize_provision_prefix(trimmed);
    let form_prefix = normalize_form_prefix(trimmed);
    let pub_prefix = normalize_pub_prefix(trimmed);

    let mut seen: HashSet<String> = HashSet::new();
    let mut prefix_group: Vec<SearchResult> = Vec::new();
    let mut fts_group: Vec<SearchResult> = Vec::new();

    // ── Provisions
    let (prov_pre, prov_fts) =
        fetch_provisions_split(&conn, &prov_prefix, &fts_query, limit)?;
    extend_unique(&mut prefix_group, &mut seen, prov_pre.into_iter().map(provision_to_result));
    extend_unique(&mut fts_group, &mut seen, prov_fts.into_iter().map(provision_to_result));

    // ── Forms
    let (form_pre, form_fts) =
        fetch_forms_split(&conn, &form_prefix, &fts_query, limit)?;
    extend_unique(&mut prefix_group, &mut seen, form_pre.into_iter().map(form_to_result));
    extend_unique(&mut fts_group, &mut seen, form_fts.into_iter().map(form_to_result));

    // ── Pubs
    let (pub_pre, pub_fts) =
        fetch_pubs_split(&conn, &pub_prefix, &fts_query, limit)?;
    extend_unique(&mut prefix_group, &mut seen, pub_pre.into_iter().map(pub_to_result));
    extend_unique(&mut fts_group, &mut seen, pub_fts.into_iter().map(pub_to_result));

    let mut merged = prefix_group;
    for r in fts_group {
        if merged.len() >= limit { break; }
        merged.push(r);
    }
    Ok(merged)
}

fn extend_unique<I: IntoIterator<Item = SearchResult>>(
    target: &mut Vec<SearchResult>,
    seen: &mut HashSet<String>,
    iter: I,
) {
    for r in iter {
        if seen.insert(r.id().to_string()) {
            target.push(r);
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-entity fetchers — return (prefix, fts) split
// ────────────────────────────────────────────────────────────────────────────

fn fetch_provisions_split(
    conn: &Connection,
    prefix: &str,
    fts_query: &str,
    limit: usize,
) -> Result<(Vec<ProvisionSummary>, Vec<ProvisionSummary>), String> {
    let mut pre: Vec<ProvisionSummary> = Vec::new();
    let mut fts_out: Vec<ProvisionSummary> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    // Prefix
    {
        let mut stmt = conn
            .prepare(
                "SELECT provision_id, source, section_number, heading,
                        body_excerpt, short_citation, popular_name
                 FROM provisions
                 WHERE UPPER(section_number) LIKE ?1
                 ORDER BY length(section_number), section_number
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![prefix, limit.min(20) as i64], map_provision_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            if seen.insert(r.provision_id.clone()) {
                pre.push(r);
            }
        }
    }

    // FTS
    if !fts_query.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT p.provision_id, p.source, p.section_number, p.heading,
                        p.body_excerpt, p.short_citation, p.popular_name
                 FROM provisions_fts f
                 JOIN provisions p ON p.rowid = f.rowid
                 WHERE provisions_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![fts_query, limit as i64], map_provision_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            if seen.insert(r.provision_id.clone()) {
                fts_out.push(r);
            }
        }
    }
    Ok((pre, fts_out))
}

fn fetch_forms_split(
    conn: &Connection,
    prefix: &str,
    fts_query: &str,
    limit: usize,
) -> Result<(Vec<FormSummary>, Vec<FormSummary>), String> {
    let mut pre: Vec<FormSummary> = Vec::new();
    let mut fts_out: Vec<FormSummary> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    {
        let mut stmt = conn
            .prepare(
                "SELECT canonical_number, category, parent_form, title, raw_product_number
                 FROM irs_forms
                 WHERE UPPER(canonical_number) LIKE ?1
                 ORDER BY length(canonical_number), canonical_number
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![prefix, limit.min(20) as i64], map_form_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            let id = form_id(&r);
            if seen.insert(id) {
                pre.push(r);
            }
        }
    }

    if !fts_query.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT f.canonical_number, f.category, f.parent_form, f.title, f.raw_product_number
                 FROM irs_forms_fts ft
                 JOIN irs_forms f ON f.rowid = ft.rowid
                 WHERE irs_forms_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![fts_query, limit as i64], map_form_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            let id = form_id(&r);
            if seen.insert(id) {
                fts_out.push(r);
            }
        }
    }
    Ok((pre, fts_out))
}

fn fetch_pubs_split(
    conn: &Connection,
    prefix: &str,
    fts_query: &str,
    limit: usize,
) -> Result<(Vec<PubSummary>, Vec<PubSummary>), String> {
    let mut pre: Vec<PubSummary> = Vec::new();
    let mut fts_out: Vec<PubSummary> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    {
        let mut stmt = conn
            .prepare(
                "SELECT pub_number, title, target_audience
                 FROM irs_publications
                 WHERE UPPER(pub_number) LIKE ?1
                 ORDER BY length(pub_number), pub_number
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![prefix, limit.min(20) as i64], map_pub_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            if seen.insert(r.pub_number.clone()) {
                pre.push(r);
            }
        }
    }

    if !fts_query.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT p.pub_number, p.title, p.target_audience
                 FROM irs_publications_fts pf
                 JOIN irs_publications p ON p.rowid = pf.rowid
                 WHERE irs_publications_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![fts_query, limit as i64], map_pub_row)
            .map_err(|e| e.to_string())?;
        for r in rows {
            let r = r.map_err(|e| e.to_string())?;
            if seen.insert(r.pub_number.clone()) {
                fts_out.push(r);
            }
        }
    }
    Ok((pre, fts_out))
}

// ────────────────────────────────────────────────────────────────────────────
// Detail fetches
// ────────────────────────────────────────────────────────────────────────────

pub fn fetch_provision(db_path: &Path, provision_id: &str) -> Result<Option<ProvisionDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT provision_id, source, title_number, title_name, section_number,
                    subsection, heading, body_compressed,
                    citation, short_citation,
                    chapter, subchapter, part, popular_name
             FROM provisions WHERE provision_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![provision_id], |row| {
            let blob: Vec<u8> = row.get(7)?;
            let body = inflate_raw_deflate(&blob).unwrap_or_default();
            Ok(ProvisionDetail {
                provision_id: row.get(0)?,
                source: row.get(1)?,
                title_number: row.get(2)?,
                title_name: row.get(3)?,
                section_number: row.get(4)?,
                subsection: row.get(5)?,
                heading: row.get(6)?,
                body,
                citation: row.get(8)?,
                short_citation: row.get(9)?,
                chapter: row.get(10)?,
                subchapter: row.get(11)?,
                part: row.get(12)?,
                popular_name: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn fetch_form(db_path: &Path, canonical: &str, parent_form: Option<&str>) -> Result<Option<FormDetail>, String> {
    let conn = open(db_path)?;
    let row_to_detail = |row: &Row| -> rusqlite::Result<FormDetail> {
        let irc_json: Option<String> = row.get(9)?;
        let pubs_json: Option<String> = row.get(10)?;
        Ok(FormDetail {
            canonical_number: row.get(0)?,
            category: row.get(1)?,
            title: row.get(2)?,
            parent_form: row.get(3)?,
            raw_product_number: row.get(4)?,
            revision_date: row.get(5)?,
            posted_date: row.get(6)?,
            pdf_url: row.get(7)?,
            instructions_pdf_url: row.get(8)?,
            related_irc: parse_string_array(irc_json),
            related_pubs: parse_string_array(pubs_json),
        })
    };

    let sql_with_parent = "SELECT canonical_number, category, title, parent_form, raw_product_number,
                                  revision_date, posted_date, pdf_url, instructions_pdf_url,
                                  related_irc_json, related_pubs_json
                           FROM irs_forms
                           WHERE canonical_number = ?1 AND parent_form = ?2";
    let sql_no_parent  = "SELECT canonical_number, category, title, parent_form, raw_product_number,
                                  revision_date, posted_date, pdf_url, instructions_pdf_url,
                                  related_irc_json, related_pubs_json
                           FROM irs_forms
                           WHERE canonical_number = ?1 AND parent_form IS NULL";

    let result = match parent_form {
        Some(p) => {
            let mut stmt = conn.prepare(sql_with_parent).map_err(|e| e.to_string())?;
            let mut rows = stmt.query_map(params![canonical, p], row_to_detail).map_err(|e| e.to_string())?;
            rows.next().map(|r| r.map_err(|e| e.to_string()))
        }
        None => {
            let mut stmt = conn.prepare(sql_no_parent).map_err(|e| e.to_string())?;
            let mut rows = stmt.query_map(params![canonical], row_to_detail).map_err(|e| e.to_string())?;
            rows.next().map(|r| r.map_err(|e| e.to_string()))
        }
    };
    match result {
        Some(Ok(d)) => Ok(Some(d)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

pub fn fetch_publication(db_path: &Path, pub_number: &str) -> Result<Option<PubDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT pub_number, title, raw_product_number, revision_date, posted_date,
                    pdf_url, target_audience, related_irc_json, related_forms_json
             FROM irs_publications WHERE pub_number = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![pub_number], |row| {
            let irc_json: Option<String> = row.get(7)?;
            let forms_json: Option<String> = row.get(8)?;
            Ok(PubDetail {
                pub_number: row.get(0)?,
                title: row.get(1)?,
                raw_product_number: row.get(2)?,
                revision_date: row.get(3)?,
                posted_date: row.get(4)?,
                pdf_url: row.get(5)?,
                target_audience: row.get(6)?,
                related_irc: parse_string_array(irc_json),
                related_forms: parse_string_array(forms_json),
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

fn form_id(s: &FormSummary) -> String {
    match &s.parent_form {
        Some(p) => format!("{p}/{}", s.canonical_number),
        None => s.canonical_number.clone(),
    }
}

fn provision_to_result(s: ProvisionSummary) -> SearchResult {
    SearchResult::Provision { id: format!("p:{}", s.provision_id), data: s }
}
fn form_to_result(s: FormSummary) -> SearchResult {
    let id = format!("f:{}", form_id(&s));
    SearchResult::Form { id, data: s }
}
fn pub_to_result(s: PubSummary) -> SearchResult {
    SearchResult::Publication { id: format!("u:{}", s.pub_number), data: s }
}

fn map_provision_row(row: &Row) -> rusqlite::Result<ProvisionSummary> {
    Ok(ProvisionSummary {
        provision_id: row.get(0)?,
        source: row.get(1)?,
        section_number: row.get(2)?,
        heading: row.get(3)?,
        body_excerpt: row.get(4)?,
        short_citation: row.get(5)?,
        popular_name: row.get(6)?,
    })
}

fn map_form_row(row: &Row) -> rusqlite::Result<FormSummary> {
    Ok(FormSummary {
        canonical_number: row.get(0)?,
        category: row.get(1)?,
        parent_form: row.get(2)?,
        title: row.get(3)?,
        raw_product_number: row.get(4)?,
    })
}

fn map_pub_row(row: &Row) -> rusqlite::Result<PubSummary> {
    Ok(PubSummary {
        pub_number: row.get(0)?,
        title: row.get(1)?,
        target_audience: row.get(2)?,
    })
}

fn parse_string_array(json: Option<String>) -> Vec<String> {
    json.as_deref()
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
        .unwrap_or_default()
}

/// FTS5 query — 2+ char alphanumeric tokens, joined with prefix '*'.
fn make_fts_query(query: &str) -> String {
    query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.chars().count() >= 2)
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Strip a leading entity-kind label so prefix LIKE matches the bare
/// identifier. Returns the LIKE pattern with trailing '%'.
fn normalize_provision_prefix(q: &str) -> String {
    let prefixes = ["§ ", "§", "SECTION ", "SEC. ", "SEC ", "SEC.",
                    "26 USC ", "26 U.S.C. ", "USC ", "CFR "];
    strip_prefix(q, &prefixes) + "%"
}

fn normalize_form_prefix(q: &str) -> String {
    let prefixes = ["FORM ", "FORM", "INST ", "INSTRUCTION ", "INSTRUCTIONS "];
    strip_prefix(q, &prefixes) + "%"
}

fn normalize_pub_prefix(q: &str) -> String {
    let prefixes = ["PUBLICATION ", "PUBLICATION",
                    "PUB. ", "PUB ", "PUB.", "PUB",
                    "P. ", "P "];
    strip_prefix(q, &prefixes) + "%"
}

fn strip_prefix(q: &str, candidates: &[&str]) -> String {
    let upper = q.to_uppercase();
    for p in candidates {
        if upper.starts_with(p) {
            return upper[p.len()..].trim().to_string();
        }
    }
    upper
}

/// Raw DEFLATE (no zlib/gzip header) inflate — matches the encoder in
/// build_sqlite.py (`zlib.compressobj(9, ..., -15)`).
fn inflate_raw_deflate(input: &[u8]) -> Option<String> {
    use std::io::Read;
    let mut decoder = flate2::read::DeflateDecoder::new(input);
    let mut out = String::new();
    decoder.read_to_string(&mut out).ok().map(|_| out)
}
