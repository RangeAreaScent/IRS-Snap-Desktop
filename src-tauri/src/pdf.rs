//! Collection -> PDF export, generated natively with printpdf 0.8.
//!
//! The WebView's window.print() is unreliable across platforms (unsupported
//! in macOS WKWebView), so the PDF is built here. The bundled NanumGothic
//! font is embedded so Korean (and other non-Latin) text renders correctly;
//! printpdf subsets the font to just the glyphs used, keeping output small.

use printpdf::*;
use serde::Deserialize;

/// NanumGothic (SIL OFL 1.1). License: src-tauri/resources/fonts/OFL.txt
const NANUM_REGULAR: &[u8] = include_bytes!("../resources/fonts/NanumGothic-Regular.ttf");
const NANUM_BOLD: &[u8] = include_bytes!("../resources/fonts/NanumGothic-Bold.ttf");

#[derive(Deserialize)]
pub struct ExportEntry {
    pub code: String,
    pub description: String,
    pub note: String,
    pub billable: String,
    pub chapter: String,
    pub block: String,
    pub category: String,
}

// US Letter, in millimetres.
const PAGE_W: f32 = 215.9;
const PAGE_H: f32 = 279.4;
const MARGIN: f32 = 18.0;
const BOTTOM_LIMIT: f32 = 16.0;
const MM_PER_PT: f32 = 0.352_777_8;

fn mm_to_pt(mm: f32) -> f32 {
    mm / MM_PER_PT
}

/// Approximate display width of a character in half-em units. CJK / Hangul
/// glyphs are roughly full-width (2 units); Latin glyphs about half-em (1).
fn char_units(c: char) -> usize {
    let u = c as u32;
    let wide = (0x1100..=0x11FF).contains(&u)   // Hangul Jamo
        || (0x2E80..=0xA4CF).contains(&u)        // CJK radicals .. Yi
        || (0xAC00..=0xD7A3).contains(&u)        // Hangul syllables
        || (0xF900..=0xFAFF).contains(&u)        // CJK compatibility ideographs
        || (0xFF00..=0xFF60).contains(&u);       // fullwidth forms
    if wide {
        2
    } else {
        1
    }
}

fn units(s: &str) -> usize {
    s.chars().map(char_units).sum()
}

/// Greedy word wrap. Width is estimated in half-em units so Latin and CJK
/// text both wrap close to the page edge.
fn wrap(s: &str, font_size: f32, avail_mm: f32) -> Vec<String> {
    let unit_mm = 0.5 * font_size * MM_PER_PT;
    let max_units = ((avail_mm / unit_mm).floor() as usize).max(8);
    let mut lines: Vec<String> = Vec::new();

    for raw in s.split('\n') {
        let mut cur = String::new();
        let mut cur_units = 0;
        for word in raw.split_whitespace() {
            let w_units = units(word);
            if cur.is_empty() {
                cur = word.to_string();
                cur_units = w_units;
            } else if cur_units + 1 + w_units <= max_units {
                cur.push(' ');
                cur.push_str(word);
                cur_units += 1 + w_units;
            } else {
                lines.push(std::mem::take(&mut cur));
                cur = word.to_string();
                cur_units = w_units;
            }
            // Hard-break a single word that is wider than the line.
            while cur_units > max_units {
                let mut head = String::new();
                let mut head_units = 0;
                let mut rest = cur.chars().peekable();
                while let Some(&c) = rest.peek() {
                    let cu = char_units(c);
                    if head_units + cu > max_units {
                        break;
                    }
                    head.push(c);
                    head_units += cu;
                    rest.next();
                }
                lines.push(head);
                cur = rest.collect();
                cur_units = units(&cur);
            }
        }
        lines.push(cur);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

/// Accumulates text into pages, flowing onto a new page at the bottom margin.
struct Layout {
    regular: FontId,
    bold: FontId,
    pages: Vec<Vec<Op>>,
    cur: Vec<Op>,
    y: f32, // mm from the page bottom
}

impl Layout {
    fn new(regular: FontId, bold: FontId) -> Self {
        Self {
            regular,
            bold,
            pages: Vec::new(),
            cur: vec![Op::StartTextSection],
            y: PAGE_H - MARGIN,
        }
    }

    fn new_page(&mut self) {
        self.cur.push(Op::EndTextSection);
        let finished = std::mem::replace(&mut self.cur, vec![Op::StartTextSection]);
        self.pages.push(finished);
        self.y = PAGE_H - MARGIN;
    }

    fn gap(&mut self, mm: f32) {
        self.y -= mm;
        if self.y < BOTTOM_LIMIT {
            self.new_page();
        }
    }

    /// Writes a single line of text centered horizontally on the page.
    /// Centering uses the same half-em width estimate as `wrap` — proportional
    /// font means it's an approximation but matches well for short headers.
    fn text_centered(&mut self, s: &str, size: f32, bold: bool) {
        let font = if bold {
            self.bold.clone()
        } else {
            self.regular.clone()
        };
        let line_h = size * 1.34 * MM_PER_PT;
        let text_w_mm = units(s) as f32 * 0.5 * size * MM_PER_PT;
        let x_mm = ((PAGE_W - text_w_mm) / 2.0).max(MARGIN);
        if self.y < BOTTOM_LIMIT {
            self.new_page();
        }
        let x = mm_to_pt(x_mm);
        let y = mm_to_pt(self.y);
        self.cur.push(Op::SetTextMatrix {
            matrix: TextMatrix::Translate(Pt(x), Pt(y)),
        });
        self.cur.push(Op::SetFontSize {
            size: Pt(size),
            font: font.clone(),
        });
        self.cur.push(Op::WriteText {
            items: vec![TextItem::Text(s.to_string())],
            font: font.clone(),
        });
        self.y -= line_h;
    }

    /// Draws a thin grey horizontal rule across the writable column.
    ///
    /// ⚠️ Per §11.7 trap: `self.y` is the baseline for the *next* row of text,
    /// not the bottom of the *previous* row. Drawing at `self.y + 0.5mm`
    /// puts the line through the next row's glyphs (cap height ~2.7mm for
    /// 11pt). `self.y + 4.5mm` sits in the natural gap between two rows.
    /// The rule itself doesn't advance y; pair with `gap()` afterwards.
    fn hr(&mut self) {
        // Path operators must come from outside a text section.
        self.cur.push(Op::EndTextSection);
        self.cur.push(Op::SetOutlineColor {
            col: Color::Rgb(Rgb {
                r: 0.82,
                g: 0.82,
                b: 0.82,
                icc_profile: None,
            }),
        });
        self.cur.push(Op::SetOutlineThickness { pt: Pt(0.4) });
        let y_pt = mm_to_pt(self.y + 4.5);
        self.cur.push(Op::DrawLine {
            line: Line {
                points: vec![
                    LinePoint {
                        p: Point {
                            x: Pt(mm_to_pt(MARGIN)),
                            y: Pt(y_pt),
                        },
                        bezier: false,
                    },
                    LinePoint {
                        p: Point {
                            x: Pt(mm_to_pt(PAGE_W - MARGIN)),
                            y: Pt(y_pt),
                        },
                        bezier: false,
                    },
                ],
                is_closed: false,
            },
        });
        self.cur.push(Op::StartTextSection);
    }

    /// Writes wrapped text at the given point size and left indent (mm).
    fn text(&mut self, s: &str, size: f32, indent: f32, bold: bool) {
        let font = if bold {
            self.bold.clone()
        } else {
            self.regular.clone()
        };
        let line_h = size * 1.34 * MM_PER_PT;
        let avail = PAGE_W - 2.0 * MARGIN - indent;
        for line in wrap(s, size, avail) {
            if self.y < BOTTOM_LIMIT {
                self.new_page();
            }
            let x = mm_to_pt(MARGIN + indent);
            let y = mm_to_pt(self.y);
            self.cur.push(Op::SetTextMatrix {
                matrix: TextMatrix::Translate(Pt(x), Pt(y)),
            });
            self.cur.push(Op::SetFontSize {
                size: Pt(size),
                font: font.clone(),
            });
            self.cur.push(Op::WriteText {
                items: vec![TextItem::Text(line)],
                font: font.clone(),
            });
            self.y -= line_h;
        }
    }

    fn finish(mut self) -> Vec<PdfPage> {
        if self.cur.len() > 1 {
            self.cur.push(Op::EndTextSection);
            self.pages.push(self.cur);
        }
        if self.pages.is_empty() {
            self.pages
                .push(vec![Op::StartTextSection, Op::EndTextSection]);
        }
        self.pages
            .into_iter()
            .map(|ops| PdfPage::new(Mm(PAGE_W), Mm(PAGE_H), ops))
            .collect()
    }
}

pub fn export(path: &str, title: &str, entries: &[ExportEntry]) -> Result<(), String> {
    let mut doc = PdfDocument::new(title);
    let regular = ParsedFont::from_bytes(NANUM_REGULAR, 0, &mut Vec::new())
        .ok_or_else(|| "failed to parse embedded font".to_string())?;
    let bold = ParsedFont::from_bytes(NANUM_BOLD, 0, &mut Vec::new())
        .ok_or_else(|| "failed to parse embedded bold font".to_string())?;
    let regular_id = doc.add_font(&regular);
    let bold_id = doc.add_font(&bold);

    let mut layout = Layout::new(regular_id, bold_id);

    // Centered header — IRS dataset summary line beneath the title.
    layout.text_centered(title, 18.0, true);
    layout.gap(1.5);
    layout.text_centered(
        &format!(
            "{} item{}  ·  IRC + Treasury Regs + IRS Forms + Pubs",
            entries.len(),
            if entries.len() == 1 { "" } else { "s" },
        ),
        9.0,
        false,
    );
    layout.gap(2.0);
    layout.hr();
    layout.gap(4.5);

    let total = entries.len();
    for (i, e) in entries.iter().enumerate() {
        layout.text(&e.code, 13.0, 0.0, true);
        layout.text(&e.description, 10.5, 0.0, false);
        if !e.note.trim().is_empty() {
            layout.text(&format!("Note: {}", e.note), 9.5, 5.0, false);
        }
        let mut meta = format!("Kind: {}", e.billable);
        if !e.chapter.is_empty() {
            meta.push_str(&format!("   ·   Detail: {}", e.chapter));
        }
        if !e.block.is_empty() {
            meta.push_str(&format!("   ·   Parent: {}", e.block));
        }
        if !e.category.is_empty() {
            meta.push_str(&format!("   ·   Source: {}", e.category));
        }
        layout.text(&meta, 8.5, 5.0, false);

        // Thin grey rule between rows — skip after the last so the trailing
        // edge stays clean.
        if i + 1 < total {
            layout.hr();
        }
        layout.gap(4.5);
    }

    // Footer disclaimer — small italic-style note, centered.
    layout.gap(4.0);
    layout.hr();
    layout.gap(3.0);
    layout.text_centered(
        "Reference only. Always verify with current IRS guidance and a qualified tax professional.",
        7.5,
        false,
    );
    layout.text_centered(
        "Sources: uscode.house.gov · ecfr.gov · irs.gov",
        7.5,
        false,
    );

    let pages = layout.finish();
    let bytes = doc
        .with_pages(pages)
        .save(&PdfSaveOptions::default(), &mut Vec::new());
    std::fs::write(path, bytes).map_err(|e| format!("cannot write PDF: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(code: &str, note: &str) -> ExportEntry {
        ExportEntry {
            code: code.into(),
            description: "Essential (primary) hypertension with a fairly long \
                description so word wrapping and page flow are exercised"
                .into(),
            note: note.into(),
            billable: "Yes".into(),
            chapter: "Diseases of the circulatory system".into(),
            block: "Hypertensive diseases".into(),
            category: "Essential (primary) hypertension".into(),
        }
    }

    #[test]
    fn produces_a_valid_ascii_pdf() {
        let path = std::env::temp_dir().join("icdsnap_pdf_ascii.pdf");
        let path = path.to_str().unwrap();
        let entries: Vec<ExportEntry> = (0..40)
            .map(|i| entry(&format!("I{i:02}"), if i % 3 == 0 { "Check coverage" } else { "" }))
            .collect();
        export(path, "Test Collection", &entries).expect("export should succeed");

        let bytes = std::fs::read(path).expect("output file should exist");
        assert_eq!(&bytes[..5], b"%PDF-", "missing PDF header");
        assert!(bytes.windows(5).any(|w| w == b"%%EOF"), "missing EOF marker");
    }

    #[test]
    fn produces_a_small_korean_pdf() {
        let path = std::env::temp_dir().join("icdsnap_pdf_korean.pdf");
        let path = path.to_str().unwrap();
        let entries = vec![entry("I10", "환자 본태성 고혈압 — 보험 확인 필요")];
        export(path, "고혈압 모음", &entries).expect("korean export should succeed");

        let bytes = std::fs::read(path).expect("output file should exist");
        assert_eq!(&bytes[..5], b"%PDF-", "missing PDF header");
        // Subsetting must keep the embedded font tiny (full font is ~2 MB).
        assert!(
            bytes.len() < 400_000,
            "korean pdf is {} bytes — font subsetting may have failed",
            bytes.len(),
        );
    }

    #[test]
    fn wrap_handles_long_words_and_cjk() {
        assert_eq!(wrap("", 10.0, 100.0), vec![String::new()]);
        assert!(wrap(&"x".repeat(500), 10.0, 80.0).len() > 1, "long word must wrap");
        assert!(wrap(&"가".repeat(200), 10.0, 80.0).len() > 1, "long Korean run must wrap");
    }
}
