# IRS Snap Desktop

Mac + Windows desktop port of [IRS Snap iOS](../IRS-Snap/). Tauri 2 + React 19 +
Rust. Forked from ICD Snap Desktop, swapped to the IRS domain. **Stage: 1
scaffold (Rust backend + UI swap pending).**

## Quick start

```bash
npm install
npm run tauri dev
```

Production bundle:

```bash
# macOS universal
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin

# Windows (on a Windows host)
npm run tauri build
```

## Status (2026-05-30)

- ✅ Folder fork from `ICD Snap_mac_win_app/`
- ✅ Identifier rename: `irs-snap-desktop`, `irssnap`, `irssnap_lib`,
  `com.ryan.irssnap`, "IRS Snap" productName/window
- ✅ Bundled SQLite: `irssnap.sqlite` (31 MB, IRC + Treasury Regs + Forms + Pubs)
- ✅ PDF export header copy → IRS domain
- ⏳ **Rust backend (`icd.rs` → `irs.rs`)** — next chunk
- ⏳ **TypeScript types** (`CodeDetail` → IRS provision/form/pub)
- ⏳ **React components** (CodeRow / CodeDetailView → IRS 3-kind)
- ⏳ App icon family regen (`npm run tauri icon`)
- ⏳ GitHub repo + CI tag-driven build

## Series context

Forked from ICD Snap Desktop. Shares all wholesale-reusable infrastructure
(license.rs, store.rs, pdf.rs core, themes, settings persistence). Only the
domain layer differs.

See:
- [`../IRS-Snap/SPEC.md`](../IRS-Snap/SPEC.md) — product spec
- [`../ICD Snap_mac_win_app/HANDOFF.md`](../ICD%20Snap_mac_win_app/HANDOFF.md) — canonical desktop reference
- [`../SNAP Series Plan/SNAP_SERIES_GUIDE.md`](../SNAP%20Series%20Plan/SNAP_SERIES_GUIDE.md) §6 — desktop fork pattern
