# IRS Snap Desktop — Handoff Document

<!-- snap-series:manager-block:start -->
- **App:** IRS Snap
- **Platform:** desktop
- **Wave:** 2
- **Stage:** 3 release  (0 spec / 1 scaffold / 2 features / 3 release / shipped)
- **Last updated:** 2026-05-31
- **Repo:** https://github.com/RangeAreaScent/IRS-Snap-Desktop (public, live 2026-05-31)
- **Latest release:** v1.0.0 draft (pushed 2026-05-31) — local universal DMG (34 MB) attached separately, CI building Windows MSI/EXE
- **Latest CI:** v1.0.0 queued (2026-05-31) — Windows-only matrix per ICD pattern, macOS DMG built locally
- **Bundle id:** com.ryan.irssnap
- **Dataset:** `irssnap.sqlite`, 31 MB, 8,296 provisions (IRC 2,145 + 26 CFR 6,151) + 1,036 forms + 978 pubs, license: public domain (uscode.house.gov, ecfr.gov, irs.gov)
- **Deviations from playbook:** Domain has 3 entity kinds (provision/form/pub) vs ICD/Code Snap's single-table layout — needs irs.rs to expose 3 search paths; types.ts + components likewise 3-way
- **Polish complete (2026-05-31):**
  - Note section in 3 detail views (Edit/Delete, persisted via JSON store)
  - RecentItemsStore (localStorage, last 20) + Recently viewed section in SearchView idle state
  - Detail body highlight — `<mark>` wrap of query tokens, search-pane only
  - Interactive hints — 8 click-to-search rows (1040, W-2, 1099-NEC, Schedule C/SE, 199A, Pub 17, depreciation)
  - Keyboard shortcuts: ⌘1/2/3/4 tab switch, ⌘F focus search
  - Settings → Reset section (Clear Recently Viewed, Reset Onboarding)
  - polished styles: badge colors (IRC/Reg/Form/Sch/Pub/Notice), chip-row, detail-toolbar, action-link, note-section
- **Desktop Phase A–D + Polish R1/R2/R3 applied (2026-06-09):** (per `../Snap Series Plan/SNAP_DESKTOP_IMPROVEMENT_PLAN.md` §11)
  - **A. Keyboard-first**: `useListKeyNav` (id-based, IRS uses `compositeKey` not `code`), Toaster (window CustomEvent), ⌘C/D/E/F/K/,/1-4 global, ⌘D toggles favorite via cached selectedItem, focus ring on selected row
  - **B. Split view**: Splitter (drag-resize 320–720px, `localStorage snap.listWidth`), `NARROW_PX=900` responsive overlay with back button + Esc, EmptyDetail with mac/win shortcut guide
  - **C. ⌘K palette**: cmdk (+18KB gzip), 5 groups (Code/Recent/Favorites/Go to/Actions), noise rules (Code ≥ 2 chars, Recent/Favs idle-only), `[cmdk-root]` guard in nav hook
  - **D. Native menu + status bar**: `menu.rs` (App/File/Edit/View/Window/Help, Help URLs to uscode.house.gov / ecfr.gov / irs.gov via `opener` plugin), `listen("menu:*")` wiring, `.app__main` flex-column with `min-height:0`, status bar shows `8,296 provisions · 1,036 forms · 978 pubs · IRC + 26 CFR + irs.gov` + ⌘K hint
  - **Polish R1**: Favorites + Collection-detail multi-select (Select button, 📁📄🗑✕ icon bar, checkbox column, `bulkRemoveFavorites` / `removeManyFromCollection` / `addFavoritesToCollection` state helpers, `BulkAddToCollectionModal`, synthetic Collection for bulk PDF export)
  - **Polish R2**: All `window.confirm` → `@tauri-apps/plugin-dialog` `ask()` (Collection delete, Note delete, Premium deactivate, Recent Clear, bulk Remove) — Tauri 2 webview silently ignores `window.confirm`
  - **Polish R3**: How to Use modal in Settings (5 sections, `<kbd>` shortcuts table, mac/win split); Copy buttons 2×2 grid + container query (`@container detail (max-width:460px)`) so splitter drag collapses gracefully; Search Relevance/Citation segmented sort using `Intl.Collator({numeric:true})`
  - Bundle: 263 → 330 KB JS (cmdk +50, How to Use + multi-select + sort minimal); cargo check + `npm run tauri dev` clean
  - **iCloud build cache trap**: `failed to read plugin permissions: ...com~apple~CloudDocs/...` from stale tauri build cache after we moved repos. Fix: `cargo clean -p tauri`. Added to series §11.7 trap table.
- **Polish R3 PDF + iOS backport (2026-06-09):**
  - `src-tauri/src/pdf.rs` — new `Layout::text_centered(s, size, bold)` (width via `units(s)*0.5em*MM_PER_PT`) and `Layout::hr()` (`EndTextSection → SetOutlineColor(grey 0.82) → SetOutlineThickness(0.4pt) → DrawLine(MARGIN..PAGE_W-MARGIN at self.y+4.5mm) → StartTextSection` — the §11.7 baseline trap value). Collection export: centered title + meta, hr after header, hr between rows, footer hr + 2-line disclaimer + sources line. `cargo test --lib pdf` 3/3 (ASCII + Korean subset + wrap).
  - iOS sister (`../IRS-Snap/`): `Views/Settings/HowToUseView.swift` new (Search / Favorites / Export / Cross-links / Tips sections using `List` + `LabeledContent`, gesture-framed not keyboard); SettingsView Recent Clear → `.confirmationDialog` via `@State` flag; CollectionExporter HTML `header { text-align: center }` + `footer { text-align: center }` + sources line — visual parity with desktop pdf.rs. `xcodebuild -destination "platform=iOS Simulator,name=iPhone 17" build` → **BUILD SUCCEEDED** (file-system-synchronized group auto-discovers HowToUseView).
- **First Mac DMG bundled (2026-05-31):**
  - `…/target/universal-apple-darwin/release/bundle/dmg/IRS Snap_1.0.0_universal.dmg` — **34 MB**
  - `…/bundle/macos/IRS Snap.app` — 53 MB, **universal Mach-O** (x86_64 + arm64)
  - Build time 3 m 12 s on Apple Silicon, unsigned (Gatekeeper warning expected on other Macs)
  - icon family regenerated from IRS Peach primary — `.icns` 123 KB + `.ico` 22 KB embedded
  - CI workflow staged at `.github/workflows/build.yml` (Windows-only matrix; macOS DMG built locally per ICD pattern)
- **Active blockers:**
  - GitHub repo not created (`IRS-Snap-Desktop`) — needed for tag-driven CI + draft release upload
  - Apple Developer cert not acquired → Mac DMG unsigned (Gatekeeper "unverified developer" on other Macs)
  - Windows code-signing cert not acquired → SmartScreen warning on install
  - Lemon Squeezy product not created → license activation untested
  - `screencapture` permission missing — manual visual verification only
- **Next 3 steps:**
  1. Smoke-test the universal DMG locally (HANDOFF §14): mount → drag-install → 199A search → § 199A detail → cross-link chip to § 162 → favorite → collection → PDF export
  2. Create GitHub repo `IRS-Snap-Desktop` → push → trigger CI workflow with first `v1.0.0` tag
  3. Decide Lemon Squeezy timing + Apple Developer enrollment (both deferred per current Wave 2 cohort policy)
- **Report-back trigger:** Rust backend swap commits, first `npm run tauri dev` showing IRS search, any tag push, any signing config change
<!-- snap-series:manager-block:end -->

> Last updated 2026-05-29. App version 1.0.0.
> Repository: <https://github.com/RangeAreaScent/IRS-Snap-Desktop>
>
> **Series context.** IRS Snap is one of ten apps in the Snap series.
> For series-wide conventions, the live cross-app dashboard, and the
> bootstrap prompts for Claude sessions, see
> `../Snap Series Plan/` (especially `SNAP_SERIES_GUIDE.md` and
> `SNAP_SERIES_STATUS.md`). This document is the canonical reference
> for the **desktop side of IRS Snap specifically**.
>
> Read sections 1–6 first, then dip into the rest as needed.

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Running in development](#5-running-in-development)
6. [Building for distribution](#6-building-for-distribution)
7. [Architecture](#7-architecture)
8. [Feature map — where each thing lives](#8-feature-map)
9. [Configuration](#9-configuration)
10. [Lemon Squeezy setup (the remaining external task)](#10-lemon-squeezy-setup)
11. [Updating the IRS dataset (FY 2027 and beyond)](#11-updating-the-icd-10-cm-data)
12. [Maintenance recipes](#12-maintenance-recipes)
13. [Known gotchas](#13-known-gotchas)
14. [Testing](#14-testing)
15. [Command cheatsheet](#15-command-cheatsheet)
16. [Appendix A — Sample GitHub Actions CI](#appendix-a--sample-github-actions-ci)
17. [Appendix B — Hardening Lemon Squeezy (product_id check)](#appendix-b--hardening-lemon-squeezy)

---

## 1. What this is

IRS Snap Desktop is a Mac + Windows desktop port of the existing **IRS Snap**
iOS app — a fast, offline IRS reference (IRC, Treasury Regs, Forms, Pubs) lookup tool. It shares no
code with the iOS app; the iOS source (sibling folder `IRS-Snap/`) is the
product reference only.

**Status as of handoff:** feature-complete.
- macOS universal DMG (Intel + Apple Silicon) packaged and verified
  locally end-to-end.
- Both macOS and Windows are built by the GitHub Actions CI workflow
  on every `v*` tag push (see §6.6 and Appendix A).
- Apple Developer signing and a Windows code-signing certificate are
  **not yet configured** — current artifacts are unsigned. Users see a
  Gatekeeper / SmartScreen warning on first launch.

**Core promise:** "Find IRS dataset entries in 2 seconds. No ads, no
subscription, works offline."

**Differentiation from the iOS app:**
- No alternate app icons (desktop app icons are fixed at install time).
- Premium = 4 themes **plus** unlimited favorites/collections (the iOS app's
  premium was cosmetic-only; we add freemium capacity limits to make
  premium an honest productivity upsell).
- Monetization via **Lemon Squeezy license keys** with online activation,
  not App Store IAP — avoids store fees and review cycles, works the same
  on Mac and Windows.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust backend, system webview frontend) |
| UI | React 19 + TypeScript + Vite |
| Backend lang | Rust (stable, edition 2021) |
| Read-only IRS data | `irssnap.sqlite` (~31 MB), bundled as a Tauri resource; FTS5 full-text + a prefix index. Accessed from Rust via `rusqlite` with the `bundled` feature (compiles SQLite + FTS5 in-tree). |
| User data | Plain JSON files in the app data directory, written atomically (`store.rs`). |
| Search abbreviations | Removed in v1 — IRS-specific abbreviations land in v1.1+. The bundled `irs.rs` does no abbreviation expansion at search time. |
| Premium license | Lemon Squeezy license API (HTTP) via `ureq`. Online activate / validate / deactivate. Per-key device limit enforced by LS server-side. |
| Hidden override | Separate stored flag; toggled by the secret version-tap rhythm. Effective unlock = real license OR override. Mirrors the iOS `SecretTapDetector`. |
| PDF export | Native generation in Rust via `printpdf 0.8` (font subsetting). Bundled NanumGothic (SIL OFL 1.1) so Korean notes render correctly while keeping output small. |
| CSV export | Built in JS, written to a user-chosen path via Tauri's dialog plugin + a Rust `write_text_file` command. |
| Window zoom | `webview.setZoom()` for the text-size setting. |

---

## 3. Repository layout

```
IRS Snap_Mac_Win_app/
├── HANDOFF.md                      ← this file
├── package.json                    ← npm scripts + frontend deps
├── tsconfig.json
├── vite.config.ts
├── index.html
├── app-icon-source.png             ← original iOS logo (1024×1024, square)
├── app-icon-rounded.png            ← macOS-style rounded version
├── src/                            ← React/TS frontend
│   ├── main.tsx                    ← React root + bundled font imports
│   ├── App.tsx                     ← Providers + tab shell + premium modal
│   ├── state.tsx                   ← AppDataProvider (favorites, collections,
│   │                                   notes, freemium limits, prompt)
│   ├── settings.tsx                ← SettingsProvider (theme, font, size, license)
│   ├── api.ts                      ← Tauri invoke wrappers
│   ├── export.ts                   ← CSV / PDF export drivers
│   ├── types.ts
│   ├── styles.css                  ← Theme variable blocks + all UI styles
│   └── components/
│       ├── SearchView.tsx
│       ├── FavoritesView.tsx
│       ├── CollectionsView.tsx     ← list + detail + menu + export wiring
│       ├── CodeRow.tsx
│       ├── CodeDetailView.tsx      ← detail pane, copy buttons, notes section
│       ├── SettingsView.tsx        ← appearance, premium, data, about
│       ├── Modal.tsx
│       ├── AddToCollectionModal.tsx
│       ├── AddCodeModal.tsx
│       ├── CollectionFormModal.tsx ← new / rename
│       └── PremiumPromptModal.tsx  ← shown when a free-tier limit blocks an add
└── src-tauri/                      ← Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json             ← productName, identifier, bundle config
    ├── build.rs                    ← tauri-build
    ├── capabilities/default.json   ← webview permissions (dialog, opener, zoom)
    ├── icons/                      ← generated by `tauri icon`
    │   ├── icon.icns               ← macOS
    │   ├── icon.ico                ← Windows
    │   └── *.png                   ← various sizes
    ├── resources/
    │   ├── irssnap.sqlite     ← 31 MB v1 dataset (2026), bundled
    │   └── fonts/
    │       ├── NanumGothic-Regular.ttf  ← embedded for Korean PDF export
    │       ├── NanumGothic-Bold.ttf
    │       └── OFL.txt                  ← font license
    └── src/
        ├── main.rs                 ← thin entry; calls icdsnap_lib::run()
        ├── lib.rs                  ← Tauri builder, AppState, command list
        ├── icd.rs                  ← SQLite + FTS5 search + detail fetch
        ├── abbreviations.rs        ← removed — IRS abbreviations land in v1.1+
        ├── store.rs                ← atomic JSON document store
        ├── license.rs              ← Lemon Squeezy + hidden override layer
        └── pdf.rs                  ← collection → PDF (with subsetting + CJK)
```

---

## 4. Prerequisites

### Common (all platforms)
- **Node.js 18+** (developed/tested on 24.15)
- **Rust stable** via [rustup](https://rustup.rs) (tested 1.95)
- **npm 9+**

### macOS
- **Xcode Command Line Tools** — `xcode-select --install`
- That's it. WebView (WKWebView) is part of the OS.

### Windows
- **rustup** — install from <https://rustup.rs>. The Windows installer
  defaults to the `x86_64-pc-windows-msvc` toolchain (what you want).
  **The rustup installer will offer to install the Visual Studio Build
  Tools 2022 for you (~1.3 GB download).** Say yes — it covers the
  next bullet automatically. No need to install Build Tools separately.
- **Microsoft Visual Studio 2022 Build Tools** with the
  "Desktop development with C++" workload — provides the MSVC linker and
  C runtime that the Rust `x86_64-pc-windows-msvc` toolchain links against.
  Installed by rustup as above; just verify the "Desktop development with
  C++" workload checkbox is checked during the VS Installer step.
- **Node.js 18+** for Windows.
- **WebView2 Runtime** — preinstalled on Windows 11. On Windows 10 the
  Tauri installer will download it during install (or the user can pre-
  install the Microsoft Evergreen Bootstrapper).

> **Cross-compiling Mac → Windows is not supported in practice.** Use a
> Windows machine, a VM, or GitHub Actions CI (Appendix A).

---

## 5. Running in development

```bash
# one-time
npm install

# every session
npm run tauri dev
```

What this does: starts Vite on `http://localhost:1420`, compiles the Rust
binary in dev mode, opens the app window. Frontend changes hot-reload
automatically; Rust changes trigger a recompile-and-relaunch on save.

**Devtools.** In dev builds, right-click anywhere in the app → "Inspect
Element" → standard Chromium DevTools.

**Logs.** Frontend: browser console (devtools). Rust: stdout of the
`npm run tauri dev` process.

**Stale port 1420.** Sometimes `tauri dev` exits but the Vite node process
keeps the port:
```bash
lsof -ti:1420 | xargs kill -9      # macOS / Linux
```
On Windows: `Get-Process -Name node | Stop-Process` (be careful — this
kills all node processes).

---

## 6. Building for distribution

### 6.1 macOS — Apple Silicon only

> Useful for fast local debugging. **Don't ship this as the public Mac
> release** — Intel Macs will refuse to launch it. The universal build
> below is what goes on the Releases page.

```bash
npm run tauri build
```

Output (`src-tauri/target/release/bundle/`):
- `macos/IRS Snap.app` (~49 MB — includes the 31 MB IRS DB)
- `dmg/IRS Snap_1.0.0_aarch64.dmg` (~10 MB — DMGs compress aggressively)

### 6.2 macOS — Universal (Intel + Apple Silicon, what ships)

```bash
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

Output: `IRS Snap_1.0.0_universal.dmg`. The `.app` binary becomes a fat
Mach-O containing both architectures (~2× the arm64 size). Use this for
public distribution.

### 6.3 Windows

On a Windows machine that satisfies the prerequisites in §4:

```cmd
git clone <repo>            REM or copy the project folder
cd IRS Snap_Mac_Win_app
npm install
npm run tauri build
```

Output (`src-tauri\target\release\bundle\`):
- `msi\IRS Snap_1.0.0_x64_en-US.msi`   ← MSI installer (recommended)
- `nsis\IRS Snap_1.0.0_x64-setup.exe`  ← NSIS setup wizard

Either one is a valid installer; ship whichever your audience prefers. The
MSI is more enterprise-friendly; the NSIS .exe is smaller and a friendlier
double-click flow for individual users.

#### 6.3.1 Windows build gotchas (learned the hard way)

These are the practical tripwires when doing the first Windows build,
especially if the project was originally developed on macOS. Hitting any
of them produces opaque error messages — save yourself the hour.

1. **Put the project at a space-free path.** Use `C:\dev\icdsnap` rather
   than `C:\Users\<you>\Desktop\IRS Snap_Win`. Tauri/cargo *usually*
   handle spaces, but rusqlite's build script and `cargo metadata`
   occasionally trip on them with cryptic errors. The fix is cheap, so
   just avoid the problem.

2. **Purge macOS metadata files (`._*`) before building on Windows.**
   If the project lived on iCloud Drive, an external drive, or any
   non-HFS volume on macOS, the OS scattered AppleDouble metadata
   files (`._default.json`, `._tauri.conf.json`, etc.) throughout the
   tree. They're invisible on Mac, fully visible on Windows, and Tauri
   chokes when its config loader reads one expecting UTF-8 JSON:

   ```
   failed to read file 'capabilities\._default.json':
   stream did not contain valid UTF-8
   ```

   Clean them on the Windows side before the first build:

   ```cmd
   cd C:\dev\icdsnap
   for /r %i in (._*) do @del "%i"
   ```

   Or via PowerShell (more reliable, handles edge cases):

   ```cmd
   powershell -Command "Get-ChildItem -Path . -Recurse -Force | Where-Object { $_.Name -like '._*' } | Remove-Item -Force"
   ```

   The repo's `.gitignore` excludes `._*` so this is a one-time
   cleanup *if you use Git* (recommended). For ZIP/USB transfers the
   metadata travels with the files — clean on Windows each time.

3. **Open a fresh terminal after installing rustup.** The installer
   updates `PATH`, but already-open `cmd`/PowerShell windows won't see
   it. Symptom: `npm run tauri build` fails with `failed to run 'cargo
   metadata' command... program not found`. Close and reopen the
   terminal, verify with `cargo --version`, then retry.

4. **"Desktop development with C++" workload must be checked in the
   Visual Studio Installer.** rustup auto-checks it during its
   first-time setup, but if you ran the VS Installer separately and
   unchecked it, the rust toolchain has no linker. Re-run the VS
   Installer → Modify → tick the workload.

5. **SmartScreen warning on first run is expected.** The installer
   isn't code-signed (see §6.5), so Windows shows "Windows protected
   your PC". Users click "More info" → "Run anyway". To eliminate the
   warning, buy a code-signing certificate and configure it per §6.5.

6. **Don't trust output silence.** `for /r %i in (._*) do @del "%i"`
   produces no output whether it found files or not (the `@` suppresses
   the echo). Always verify with `dir /s /b /a ._*` afterwards — if
   nothing matches, you'll get "File Not Found", which is the success
   case.

**WebView2.** Tauri's default `tauri.conf.json` doesn't specify a WebView2
install mode. On Windows 11 WebView2 is preinstalled. On older Windows 10
machines the installer will prompt to install it. If you want to bundle it
into the installer (~150 MB larger), edit `tauri.conf.json`:
```json
"bundle": {
  ...
  "windows": {
    "webviewInstallMode": { "type": "embedBootstrapper" }
  }
}
```

### 6.4 GitHub Actions CI (recommended for Windows)

If you don't have a Windows machine, the cleanest path is a GitHub Actions
workflow that builds Mac and Windows on every push or tag. See
[Appendix A](#appendix-a--sample-github-actions-ci) for a ready-to-paste
`.github/workflows/build.yml`.

### 6.5 Code signing & notarization

Unsigned builds work but trigger scary warnings on other users' machines.

#### macOS — Developer ID + notarization
Requires an Apple Developer Program account ($99/yr) and a "Developer ID
Application" certificate in your keychain. Set these env vars before
`npm run tauri build`:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # not your Apple ID password
export APPLE_TEAM_ID="TEAMID"
```
Tauri then signs the `.app` and submits it for notarization in one step.

#### Windows — code signing certificate
Requires a Code Signing Certificate (~$60–300/yr from Sectigo, DigiCert,
etc., or an EV cert for SmartScreen reputation). Add to
`tauri.conf.json`:
```json
"bundle": {
  "windows": {
    "certificateThumbprint": "AB12CD34...",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

### 6.6 Cutting a release

The shipping path is **tag-driven CI** — push a `v*` tag and the workflow
builds Mac universal + Windows in parallel and attaches the artifacts to a
draft GitHub Release. The full sequence:

1. **Bump the version in four places** (they must all match):
   - `src-tauri/Cargo.toml` → `version = "1.0.1"`
   - `src-tauri/tauri.conf.json` → `"version": "1.0.1"`
   - `package.json` → `"version": "1.0.1"`
   - `HANDOFF.md` header → `App version 1.0.1`
2. **Commit on `main`** with a `chore: bump to vX.Y.Z` message.
3. **Tag and push:**
   ```bash
   git tag v1.0.1
   git push origin main v1.0.1
   ```
4. **Watch the CI run:**
   ```bash
   gh run watch                          # live status of the latest run
   gh run view --log-failed              # if anything fails, scoped logs
   ```
5. **Review the draft release** at
   `https://github.com/RangeAreaScent/IRS-Snap-Desktop/releases` — confirm
   the Mac `.dmg` and the Windows `.msi` + `.exe` are attached and have
   sensible sizes (Mac ~18 MB DMG, Windows ~13 MB MSI).
6. **Smoke-test** at least the universal DMG on Apple Silicon (and Intel
   if you have access). See §14 for the checklist.
7. **Publish** the draft release in the GitHub UI when satisfied.

#### Redoing a botched tag

CI can fail after a tag is pushed (the failed run leaves a draft release
with partial or no artifacts attached). To redo cleanly:

```bash
gh release delete v1.0.1 --cleanup-tag --yes   # removes the draft + tag
git fetch --tags --prune --prune-tags          # sync local view
# fix whatever was broken, commit on main
git tag v1.0.1                                  # re-tag from new HEAD
git push origin v1.0.1                          # re-trigger CI
```

This is exactly what we did to recover the initial `v1.0.0` after the
Apple-codesign workflow misconfiguration was fixed (see §13 #13).

---

## 7. Architecture

### 7.1 Backend (Rust)

The Rust crate is named `icdsnap`, with a `_lib` suffix on the library
(`icdsnap_lib`) — required for Windows lib/bin coexistence.

Modules in `src-tauri/src/`:

- **`main.rs`** — 4-line entry: `fn main() { icdsnap_lib::run() }`.
- **`lib.rs`** — Tauri `Builder`, `AppState` (resolved db_path + data_dir),
  command registration. Plugins: `tauri-plugin-opener`,
  `tauri-plugin-dialog`. Capability: `core:webview:allow-set-webview-zoom`
  so `setZoom()` works from JS.
- **`icd.rs`** — actor-style read-only SQLite access. Each command opens a
  fresh `Connection` with `SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX` —
  cheap (just a file handle), no shared locking, no contention. Two-stage
  search: code-prefix `LIKE` query first, then FTS5 `MATCH`, deduped.
- **`abbreviations.rs`** — `&[(&str, &str)]` constant + an `expand(query)`
  that tokenizes on non-alphanumerics, looks up uppercase tokens, joins
  matches into the expanded query. Mirrors the iOS dictionary 1:1.
- **`store.rs`** — `read(dir, name) -> Option<String>` and
  `write(dir, name, content)`. Atomic write = write `<name>.json.tmp` →
  `rename` to `<name>.json`. Validates JSON before persisting so a crash
  can never leave a half-written file.
- **`license.rs`** — Lemon Squeezy API client + the override layer:
  - `status(dir)` — instant, no network. Loads stored license + ORs the
    override.
  - `validate(dir)` — calls LS `/validate`. Network failure → grace period
    (keep current state). Explicit invalid → lock. Then ORs override.
  - `activate(dir, key)` — LS `/activate`. On success stores
    `{unlocked, key, instance_id}`.
  - `deactivate(dir)` — LS `/deactivate` + clears local license file.
  - `toggle_override(dir)` — flips a separate `premium_override.json`.
- **`pdf.rs`** — collection → PDF. Uses `printpdf 0.8` which auto-subsets
  embedded fonts (only the glyphs actually used are stored in the PDF).
  Always embeds NanumGothic Regular + Bold (cheap with subsetting; ASCII
  exports → ~80 KB, Korean exports → ~40 KB). Manual page-flow layout,
  with a CJK-aware text wrapper that counts Hangul as ~2× the width of
  Latin characters. Three unit tests verify the output is a valid PDF.

### 7.2 Frontend (React / TypeScript)

- **`main.tsx`** — boots React, imports the bundled fonts:
  ```ts
  import "@fontsource-variable/inter";
  import "@fontsource/atkinson-hyperlegible/400.css";
  import "@fontsource/atkinson-hyperlegible/700.css";
  ```
- **`App.tsx`** — wraps everything in `<SettingsProvider><AppDataProvider>`,
  then `<AppShell>` (tab state + content + PremiumPromptModal).
- **`state.tsx` — AppDataProvider** — exposes favorites, collections, notes,
  the freemium limits (`favoritesMax`, `collectionsMax`), and the pending
  `premiumPrompt`. Internally uses `usePersistentState` which loads once
  and persists on every change.
- **`settings.tsx` — SettingsProvider** — theme, fontFamily, fontSize, and
  the license state. Settings persist together as one `settings.json` doc.
  Theme application uses a `data-theme` attribute on `<html>`. Font family
  sets the `--ui-font` CSS variable. Text size calls
  `getCurrentWebview().setZoom(factor)`.
- **`api.ts`** — `searchCodes`, `getCodeDetail`, `storeRead`, `storeWrite`.
- **`export.ts`** — collection → CSV (built in JS, written via the dialog
  plugin + the `write_text_file` Rust command) or PDF (calls the Rust
  `export_pdf` command). Both enrich items with full classification + the
  saved note before exporting.

### 7.3 IPC commands

| Command | Direction | Purpose | Inputs | Output |
|---|---|---|---|---|
| `search_codes` | JS → Rust | FTS5 + prefix search | `query`, `limit?` | `SearchResult[]` |
| `get_code_detail` | JS → Rust | Fetch full row by code | `code` | `CodeDetail \| null` |
| `store_read` | JS → Rust | Read a JSON doc | `name` | `string \| null` |
| `store_write` | JS → Rust | Atomically write a JSON doc | `name`, `content` | `()` |
| `write_text_file` | JS → Rust | Write text to a user-picked path | `path`, `content` | `()` |
| `export_pdf` | JS → Rust | Render a PDF from entries | `path`, `title`, `entries` | `()` |
| `license_status` | JS → Rust | Instant load (no network) | — | `LicenseState` |
| `license_activate` | JS → Rust | LS activate (online) | `key` | `LicenseState` |
| `license_validate` | JS → Rust | LS validate (online + grace) | — | `LicenseState` |
| `license_deactivate` | JS → Rust | LS deactivate + clear local | — | `LicenseState` |
| `license_toggle_override` | JS → Rust | Flip the hidden override | — | `LicenseState` |

### 7.4 Data persistence

User data lives in the OS-standard app data directory under the bundle
identifier `com.ryan.icdsnap`:

- **macOS:** `~/Library/Application Support/com.ryan.icdsnap/`
- **Windows:** `%APPDATA%\com.ryan.icdsnap\` (i.e. `C:\Users\<you>\AppData\Roaming\com.ryan.icdsnap\`)
- **Linux:** `~/.config/com.ryan.icdsnap/` (if anyone ever builds for Linux)

Files written:
- `favorites.json` — `Favorite[]`
- `collections.json` — `Collection[]` (each with `items[]`)
- `notes.json` — `Record<code, {text, editedAt}>`
- `settings.json` — `{theme, fontFamily, fontSize}`
- `license.json` — `{unlocked, key, instanceId}`
- `premium_override.json` — JSON bool (`true` / `false`)

The bundled SQLite DB is read-only at the app's Resource path; it never
moves to the user's data dir.

---

## 8. Feature map

Use this to jump straight to where a feature lives.

| Feature | Frontend | Backend |
|---|---|---|
| Search | `components/SearchView.tsx` | `icd.rs::search` + `abbreviations.rs` |
| Code detail | `components/CodeDetailView.tsx` | `icd.rs::fetch_detail` |
| Copy buttons | `CodeDetailView.tsx` (`navigator.clipboard`) | — |
| Favorites | `components/FavoritesView.tsx`, `state.tsx` | `store.rs` (`favorites`) |
| Collections | `components/CollectionsView.tsx`, `state.tsx` | `store.rs` (`collections`) |
| Add code to collection | `AddToCollectionModal.tsx`, `AddCodeModal.tsx` | — |
| Notes | `CodeDetailView.tsx` (`NoteSection`), `state.tsx` | `store.rs` (`notes`) |
| CSV export | `export.ts`, `CollectionsView.tsx` menu | `write_text_file` |
| PDF export | `export.ts` | `pdf.rs` (`export_pdf`) |
| Themes | `settings.tsx`, `styles.css` `[data-theme]` blocks | — |
| Font family | `main.tsx` imports, `settings.tsx` `FONT_STACKS` | — |
| Text size | `settings.tsx` `ZOOM_FACTORS` (`webview.setZoom`) | — |
| Lemon Squeezy license | `SettingsView.tsx` `PremiumSection`, `settings.tsx` | `license.rs` |
| Freemium limits | `state.tsx` `FREE_FAVORITES_MAX`, `FREE_COLLECTIONS_MAX` | — |
| Premium prompt modal | `components/PremiumPromptModal.tsx`, `App.tsx` | — |
| Hidden rhythm | `SettingsView.tsx` `useSecretRhythm` + Version row | `license::toggle_override` |
| App icon | `src-tauri/icons/`, `app-icon-*.png` | — |

---

## 9. Configuration

Version is in four places — bump them together on a release (see §6.6
for the full release flow):
- `src-tauri/Cargo.toml` — `version = "1.0.0"`
- `src-tauri/tauri.conf.json` — `"version": "1.0.0"`
- `package.json` — `"version": "1.0.0"`
- `HANDOFF.md` header — `App version 1.0.0`

Bundle identifier (`com.ryan.icdsnap`) and product name (`IRS Snap`) live
in `src-tauri/tauri.conf.json`. Don't change the identifier post-launch
— it determines the app data directory path; changing it would orphan
existing users' data.

No secrets are stored in the repo. The Lemon Squeezy license API endpoints
used are unauthenticated (public), as designed by LS for client apps.

---

## 10. Lemon Squeezy setup

The license integration is fully built but cannot work end-to-end until
someone creates the actual LS product. The flow once set up:

1. **Sign up** at <https://lemonsqueezy.com>. LS acts as merchant of record
   so they handle global tax, payment, refunds, fraud.
2. **Create a Store** in the dashboard (name, country, currency).
3. **Create a Product:**
   - Name: e.g. "IRS Snap Premium"
   - Pricing: one-time, e.g. $4.99
   - **License Keys: enabled.** Set "Activation limit" to **2** (matches
     the per-key device cap we agreed on).
   - Optionally set a max validations per period for abuse control.
4. **Test** with a test license key from the LS dashboard:
   - In the app: Settings → Premium → paste key → Activate.
   - LS dashboard: the license now shows one "instance" with name
     "IRS Snap Desktop". Activate on a second machine; a second instance
     appears. A third machine should be refused.
5. **Tighten validation (recommended once the product is created):** add a
   `product_id` check so keys from other LS products in the same account
   can't accidentally unlock IRS Snap. See [Appendix B](#appendix-b--hardening-lemon-squeezy).
6. **Point users at the LS checkout URL** from the in-app About page or
   marketing site. After purchase LS emails the buyer their license key.

API endpoints used by the app (anonymous, no API key needed):
- `POST https://api.lemonsqueezy.com/v1/licenses/activate`
- `POST https://api.lemonsqueezy.com/v1/licenses/validate`
- `POST https://api.lemonsqueezy.com/v1/licenses/deactivate`

The activation flow stores `{key, instance_id}` locally. On each launch
`validate` is called; offline / LS-down keeps the existing state (grace
period). Only an explicit `valid: false` from LS locks premium.

---

## 11. Updating the IRS dataset

The US Code (uscode.house.gov) + eCFR (ecfr.gov) + IRS (irs.gov) publish updates (fiscal year, October cutover).
When FY 2027 comes out:

1. Download the FY 2027 IRS source files (public domain).
2. Build a SQLite with the same schema as the current `irssnap.sqlite`
   (a Python script does this in the iOS project's data pipeline):
   ```sql
   CREATE TABLE codes (
       code                 TEXT PRIMARY KEY,
       description          TEXT NOT NULL,
       is_billable          INTEGER NOT NULL,
       chapter_number       TEXT,
       chapter_description  TEXT,
       block_code           TEXT,
       block_description    TEXT,
       category_code        TEXT,
       category_description TEXT
   );
   CREATE VIRTUAL TABLE codes_fts USING fts5(
       code, description, content='codes', content_rowid='rowid'
   );
   CREATE INDEX idx_billable ON codes(is_billable);
   CREATE INDEX idx_chapter  ON codes(chapter_number);
   CREATE INDEX idx_block    ON codes(block_code);
   ```
   Don't forget to populate `codes_fts` from `codes`.
3. Drop `icd10cm_2027.sqlite` into `src-tauri/resources/`. Remove the 2026
   file or keep it around for diffs.
4. Update the path in two places:
   - `src-tauri/src/lib.rs` — the `app.path().resolve("resources/irssnap.sqlite", ...)` call.
   - `src-tauri/tauri.conf.json` — `bundle.resources`.
5. Update the version label in `src/components/SettingsView.tsx` (Data
   section: "FY 2026" → "FY 2027") and the billable code count.
6. Update the same in `src-tauri/src/pdf.rs` (the export header line).
7. Bump the app version (§9) and rebuild.

Existing users' favorites/collections/notes survive — they're keyed by
provisionId / compositeKey, which is stable across years (deprecated codes still
exist in the new dataset, just not billable).

---

## 12. Maintenance recipes

### Change the free-tier limits
`src/state.tsx` — edit `FREE_FAVORITES_MAX` / `FREE_COLLECTIONS_MAX`.
Frontend-only; HMR picks it up. Also update the user-facing copy in
`src/components/SettingsView.tsx` (the "Free plan: X / 15 favorites…"
line) and in the prompt messages inside `state.tsx`.

### Add a new theme
1. `src/settings.tsx` — add to the `Theme` union, the `PREMIUM_THEMES` or
   `FREE_THEMES` array, and `THEME_LABELS`.
2. `src/styles.css` — add a `[data-theme="newname"] { --bg: ...; ... }`
   block. Keep all 16 CSS variables defined.
3. `src/components/SettingsView.tsx` — add a `SWATCH` entry (two hex
   values: outer background and accent dot).

### Add a new font family
1. `npm install @fontsource/<font>` (or `@fontsource-variable/<font>` for a
   variable font).
2. Import the CSS in `src/main.tsx`:
   ```ts
   import "@fontsource/your-font/400.css";
   import "@fontsource/your-font/700.css";
   ```
3. `src/settings.tsx` — add to `FontFamily` union, `FONT_FAMILIES`,
   `FONT_LABELS`, and `FONT_STACKS` (use the family name fontsource
   registered, e.g. `"Your Font"`).
4. `src/components/SettingsView.tsx` — add a `FONT_PREVIEW` stack so the
   preview card uses the right font.

### Add a new abbreviation
`src-tauri/src/abbreviations.rs` — add a `("ABBR", "expansion")` tuple to
the `DICTIONARY` constant. Lookup is uppercase-insensitive. Make sure the
expansion phrase appears verbatim in at least one IRS dataset entry text, or
add multiple variants.

### Change zoom factors / add another text size
`src/settings.tsx` — `FontSize` union, `FONT_SIZES`, `FONT_SIZE_LABELS`,
`ZOOM_FACTORS`. The segmented control auto-renders the new option.

### Change the app icon
1. Replace `app-icon-source.png` (square) or `app-icon-rounded.png`
   (macOS-style rounded). Keep both for future regeneration.
2. `npm run tauri icon app-icon-rounded.png` — overwrites
   `src-tauri/icons/*`.
3. **Touch `src-tauri/src/lib.rs`** (so `generate_context!` re-embeds the
   window icon — see Gotcha #1).
4. Rebuild.

### Disable the hidden rhythm in a shipping build
Remove the `onClick={secretTap}` attribute from the Version `<span>` in
`src/components/SettingsView.tsx`. The `useSecretRhythm` hook is now
unused but harmless.

### Add a Lemon Squeezy `product_id` check
See [Appendix B](#appendix-b--hardening-lemon-squeezy).

---

## 13. Known gotchas

1. **Icon changes don't auto-rebuild `lib.rs`.** The window icon is
   embedded by the `generate_context!` macro at compile time. Changing
   files in `src-tauri/icons/` doesn't change any `.rs` file, so cargo
   thinks nothing needs rebuilding. After `tauri icon`, `touch src-tauri/src/lib.rs`
   to force a recompile.

2. **Port 1420 lingers** sometimes after killing `tauri dev`. The Vite
   node child outlives the parent. `lsof -ti:1420 | xargs kill -9` on
   macOS; on Windows kill the node process via Task Manager.

3. **WKWebView (macOS) doesn't support `window.print()`.** That's why PDF
   export is implemented natively in Rust via `printpdf`. Don't be tempted
   to "simplify" by switching to webview print — it will silently no-op on
   Mac.

4. **macOS dock icon won't update in `tauri dev` without a lib.rs
   recompile.** Same root cause as #1. In packaged `.app` builds the icon
   comes from the embedded `.icns`, which is rebuilt every `tauri build`.

5. **Spaces in the project path.** The iCloud path contains spaces; most
   tools handle it but some need quoting. Always quote paths in shell
   commands.

6. **DMG creation runs `osascript`** to set the window layout — can fail
   silently when AppleScript can't reach Finder (CI, non-interactive
   shells, automation tools without Accessibility permission). The `.app`
   is still built; only the final DMG packaging aborts. Hand-create a DMG
   with `hdiutil` as a fallback — produces a clean drag-to-Applications
   DMG without any AppleScript:
   ```bash
   cd src-tauri/target/universal-apple-darwin/release/bundle
   rm -f "macos/rw."*".dmg"             # clean abandoned bundle_dmg tempfile
   mkdir -p _dmg_staging
   cp -R "macos/IRS Snap.app" _dmg_staging/
   ln -sf /Applications _dmg_staging/Applications
   hdiutil create -fs HFS+ -volname "IRS Snap" \
       -srcfolder _dmg_staging -format UDZO -ov \
       "dmg/IRS Snap_1.0.0_universal.dmg"
   rm -rf _dmg_staging
   ```
   This is what we used to produce the shipped universal DMG. The GitHub
   `macos-latest` runner has AppleScript access and `bundle_dmg.sh` works
   there — only local sandboxed shells hit the failure.

7. **Premium override layering:** effective unlock is
   `real_license OR override`. The hidden rhythm toggles the override
   only, never the real license. A real LS license can be deactivated
   only via the Premium section's "Deactivate on this computer" button
   (which also calls the LS API to free the slot).

8. **printpdf 0.8 builtin font fallback:** if no `ParsedFont` is added,
   the builtin Helvetica is usable via `Op::WriteTextBuiltinFont` — but
   builtin fonts can't render non-Latin-1 chars. The current code always
   uses the embedded NanumGothic (subsetted, tiny) so any input renders
   correctly. Don't switch back to builtins without a non-Latin
   detection fallback.

9. **SwiftData/iOS schema-migration notes don't apply.** The desktop app
   uses plain JSON. To add a field, just default it on read.

10. **Korean PDF size scales with unique Hangul characters.** Subsetting
    embeds only the glyphs used. A PDF with 200 unique Hangul chars
    might be ~50 KB; one with 2000 unique chars ~200 KB. Still tiny vs.
    the unsubset 2 MB.

11. **macOS `._*` metadata files break Windows builds.** When the
    project lives on iCloud Drive or any non-HFS volume, macOS writes
    AppleDouble metadata files (`._default.json`, etc.) alongside
    every real file. They're invisible on macOS but visible on Windows,
    and Tauri's config loader fails with `stream did not contain
    valid UTF-8` when it tries to parse one. The repo's `.gitignore`
    excludes `._*`, so Git-based transfers are safe. For ZIP/USB
    transfers, clean on Windows before building (see §6.3.1 #2). When
    setting up a new Snap-series project, add `._*` to `.gitignore`
    on day one.

12. **GitHub Actions default token is read-only.** New repos created
    after ~mid-2023 get a workflow `GITHUB_TOKEN` with read-only
    `contents` permission by default. The `tauri-action` needs write
    access to create the Release, and the token must also be
    *explicitly* passed via `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
    Without both, builds succeed but fail at the publish step with
    `Error: GITHUB_TOKEN is required` — see Appendix A for the
    workflow that already includes both fixes.

13. **Don't pass `APPLE_*` env vars on CI until you actually have a
    Developer ID cert.** If `APPLE_SIGNING_IDENTITY` is set as a
    secret (even partially set, or set to a stale value) but the
    matching `.p12` isn't imported into a keychain on the runner, the
    macOS build runs for ~15 min compiling everything and then dies at
    bundling with:
    ```
    error: The specified item could not be found in the keychain.
    failed codesign application: failed to run command codesign
    ```
    Tauri attempts to sign because *some* identity env var was provided;
    it cannot find the cert; the whole job fails. Fix: leave the
    `APPLE_*` env block out of the workflow until the full set
    (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
    `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) is configured as
    repo secrets. The current `.github/workflows/build.yml` ships
    *without* the APPLE_* lines for this reason — see the comment block
    inside it for the one-shot edit to add them when ready.

---

## 14. Testing

### Rust
```bash
cd src-tauri
cargo test --lib
```
Current suite (in `src/pdf.rs`):
- `produces_a_valid_ascii_pdf` — generates an English PDF with page break,
  asserts `%PDF-` header + `%%EOF`.
- `produces_a_small_korean_pdf` — Korean content with em-dash, asserts
  file size < 400 KB (verifies subsetting actually happened).
- `wrap_handles_long_words_and_cjk` — word wrap unit tests.

No tests for `icd.rs` / `license.rs` / `store.rs` yet — manual smoke
tests cover them. Worth adding once you have a CI pipeline.

### Frontend
No automated tests yet. The UI is small enough that manual smoke is
faster, and the components are decoupled (state vs. presentation) so
testing them in isolation is straightforward when you want to add Vitest.

### Manual smoke test (every release)
- [ ] Search: "hypertension" (description) / "I10" (code) / "HTN"
      (abbreviation) — all return relevant results.
- [ ] Code detail: click a result → details + copy buttons all paste
      correctly into a text app (4 buttons when a note exists: code only,
      code + description, code + note, full detail; 3 when no note).
      Full detail includes the note inline.
- [ ] Favorite: ☆ a code → switches state → appears in Favorites tab →
      survives app restart.
- [ ] Collection: create → add codes → ⋯ menu → CSV exports correctly
      (open in Numbers/Excel) → PDF exports correctly (open in Preview).
- [ ] Notes: add Korean text to a code's note → restart → still there →
      export PDF → Korean renders.
- [ ] Theme: pick each theme → UI updates → restart → persisted.
- [ ] Font: try each family + each size → restart → persisted.
- [ ] Premium hidden rhythm: tap-tap pause tap-tap pause tap-tap on
      "Version 1.0.0" → "Premium override toggled" flash → premium
      themes unlock.
- [ ] Free-tier limits: with override OFF, add 16th favorite → upsell
      modal. Try to create 11th collection → upsell modal. Existing
      data is not deleted.
- [ ] License: with the Lemon Squeezy product live, paste a real key →
      Activate succeeds → second machine activates → third machine
      refused.

---

## 15. Command cheatsheet

```bash
# install (once)
npm install

# dev
npm run tauri dev

# release — macOS Apple Silicon
npm run tauri build

# release — macOS universal (Intel + ARM)
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin

# release — Windows (run on Windows)
npm run tauri build

# Rust tests
cd src-tauri && cargo test --lib

# regenerate app icons from a 1024×1024 PNG
npm run tauri icon app-icon-rounded.png
touch src-tauri/src/lib.rs   # force re-embed

# kill stuck dev server (macOS)
lsof -ti:1420 | xargs kill -9

# Mac signing env vars (before tauri build)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"

# release / CI flow (gh CLI)
git tag v1.0.1 && git push origin main v1.0.1   # trigger CI on tag
gh run watch                                     # live status of latest run
gh run list --workflow=build.yml --limit 5       # recent runs
gh run view <id> --log-failed                    # only failed steps' logs
gh release view v1.0.1                           # check draft release
gh release delete v1.0.1 --cleanup-tag --yes     # nuke a botched tag+release
```

---

## Appendix A — Sample GitHub Actions CI

Save as `.github/workflows/build.yml`. Triggers on every push of a tag
matching `v*` and produces Mac + Windows artifacts attached to a draft
release.

```yaml
name: build

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    permissions:
      contents: write          # required to create the Release
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target universal-apple-darwin
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: setup rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: cache cargo
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: install frontend deps
        run: npm ci

      - name: build with tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # required by tauri-action
          # No Apple signing yet — produces unsigned artifacts. Once an
          # Apple Developer cert is available, add these as repo secrets
          # and pass them here:
          #   APPLE_CERTIFICATE          (base64 of the exported .p12)
          #   APPLE_CERTIFICATE_PASSWORD
          #   APPLE_SIGNING_IDENTITY     ("Developer ID Application: Name (TEAMID)")
          #   APPLE_ID
          #   APPLE_PASSWORD             (app-specific password)
          #   APPLE_TEAM_ID
        with:
          args: ${{ matrix.args }}
          tagName: ${{ github.ref_name }}
          releaseName: 'IRS Snap ${{ github.ref_name }}'
          releaseDraft: true
```

On a release push (e.g. `git tag v1.0.0 && git push --tags`) this builds
a universal macOS DMG and a Windows MSI + NSIS and attaches them to a
draft GitHub Release for you to review and publish.

> **Why both `permissions: contents: write` AND the `GITHUB_TOKEN` env
> var?** Two separate requirements. The `permissions:` block widens
> the auto-token's scope from read-only (the post-2023 default for new
> repos) to read+write so it's *allowed* to create a release. The env
> var is needed because `tauri-action` reads `GITHUB_TOKEN` from the
> environment, not from the implicit context — without it the action
> exits early with `Error: GITHUB_TOKEN is required`. Omit either and
> the build succeeds (15+ minutes) but produces no Release. This bit
> us on the first attempted CI build; both lines are non-optional.

> **PAT `workflow` scope (one-time, for the developer pushing).** When
> first pushing this workflow file from a local machine, the developer's
> Personal Access Token must have the **`workflow`** scope in addition
> to `repo`. Otherwise `git push` is rejected with `refusing to allow
> a Personal Access Token to create or update workflow ... without
> workflow scope`. Fix: edit the PAT at
> <https://github.com/settings/tokens>, tick `workflow`, save. This is
> distinct from the `GITHUB_TOKEN` discussed above — the PAT is *your
> credential to push code*; `GITHUB_TOKEN` is *the runner's credential
> to create a release*. Same word "token", entirely different scopes
> and lifetimes.

---

## Appendix B — Hardening Lemon Squeezy

Once you have a real LS product, add a `product_id` check so license keys
from any other LS product in your account can't accidentally unlock IRS
Snap.

In `src-tauri/src/license.rs`:

```rust
/// Replace 0 with the real product ID from your LS dashboard URL.
const EXPECTED_PRODUCT_ID: u64 = 0;

#[derive(Deserialize)]
struct ActivateResp {
    activated: bool,
    error: Option<String>,
    instance: Option<Instance>,
    meta: Option<Meta>,                  // <- add this
}

#[derive(Deserialize)]
struct ValidateResp {
    valid: bool,
    meta: Option<Meta>,                  // <- add this
}

#[derive(Deserialize)]
struct Meta {
    product_id: u64,
}

fn product_id_ok(meta: &Option<Meta>) -> bool {
    EXPECTED_PRODUCT_ID == 0
        || meta.as_ref().map(|m| m.product_id) == Some(EXPECTED_PRODUCT_ID)
}
```

Then in `activate`:
```rust
if !resp.activated || !product_id_ok(&resp.meta) {
    return Err(resp.error.unwrap_or_else(|| "This license key is not valid for IRS Snap.".into()));
}
```

And in the validate path, treat a product_id mismatch as `valid: false`
(lock the app and clear the stored license).

Leaving `EXPECTED_PRODUCT_ID = 0` is the current state — the check is a
no-op and any LS key activates. Set it to the real number when ready.

---

*End of handoff.*
